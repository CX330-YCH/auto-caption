@preconcurrency import AVFoundation
import CoreMedia
import Foundation
import Speech

struct TranscriptionReadyPayload: Encodable {
    let locale: String
    let sampleRate: Double
    let channels: UInt32
}

final class PCMInputConverter {
    let sourceFormat: AVAudioFormat
    let analyzerFormat: AVAudioFormat
    private let converter: AVAudioConverter?

    init(sampleRate: Double, channels: AVAudioChannelCount, analyzerFormat: AVAudioFormat) throws {
        guard let sourceFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: sampleRate,
            channels: channels,
            interleaved: true
        ) else { throw HelperCommandError.invalidAudioFormat }
        self.sourceFormat = sourceFormat
        self.analyzerFormat = analyzerFormat
        self.converter = sourceFormat == analyzerFormat
            ? nil
            : AVAudioConverter(from: sourceFormat, to: analyzerFormat)
        if sourceFormat != analyzerFormat && converter == nil {
            throw HelperCommandError.invalidAudioFormat
        }
    }

    func convert(_ data: Data) throws -> AVAudioPCMBuffer {
        let bytesPerFrame = Int(sourceFormat.streamDescription.pointee.mBytesPerFrame)
        guard bytesPerFrame > 0, data.count % bytesPerFrame == 0 else {
            throw HelperCommandError.invalidAudioFormat
        }
        let frameCount = AVAudioFrameCount(data.count / bytesPerFrame)
        guard let input = AVAudioPCMBuffer(
            pcmFormat: sourceFormat,
            frameCapacity: frameCount
        ) else { throw HelperCommandError.invalidAudioFormat }
        input.frameLength = frameCount
        guard let destination = input.mutableAudioBufferList.pointee.mBuffers.mData else {
            throw HelperCommandError.invalidAudioFormat
        }
        data.copyBytes(to: destination.assumingMemoryBound(to: UInt8.self), count: data.count)
        guard let converter else { return input }

        let ratio = analyzerFormat.sampleRate / sourceFormat.sampleRate
        let capacity = AVAudioFrameCount(max(1, ceil(Double(frameCount) * ratio) + 32))
        guard let output = AVAudioPCMBuffer(
            pcmFormat: analyzerFormat,
            frameCapacity: capacity
        ) else { throw HelperCommandError.invalidAudioFormat }
        let inputState = ConverterInputState(input)
        var conversionError: NSError?
        let status = converter.convert(to: output, error: &conversionError) { _, inputStatus in
            inputState.next(inputStatus)
        }
        if let conversionError { throw conversionError }
        guard status == .haveData || status == .inputRanDry else {
            throw HelperCommandError.invalidAudioFormat
        }
        return output
    }
}

private final class ConverterInputState: @unchecked Sendable {
    private let lock = NSLock()
    private let buffer: AVAudioPCMBuffer
    private var supplied = false

    init(_ buffer: AVAudioPCMBuffer) {
        self.buffer = buffer
    }

    func next(
        _ status: UnsafeMutablePointer<AVAudioConverterInputStatus>
    ) -> AVAudioBuffer? {
        lock.lock()
        defer { lock.unlock() }
        guard !supplied else {
            status.pointee = .noDataNow
            return nil
        }
        supplied = true
        status.pointee = .haveData
        return buffer
    }
}

private actor TranscriptEventCoordinator {
    private let reconciler = TranscriptReconciler()
    private let writer: JSONLineWriter

    init(writer: JSONLineWriter) {
        self.writer = writer
    }

    func consume(_ observation: TranscriptObservation) {
        for event in reconciler.consume(observation) {
            writer.write(type: "transcript", payload: event)
        }
    }

    func finalizeRemaining() {
        for event in reconciler.finalizeRemaining() {
            writer.write(type: "transcript", payload: event)
        }
    }
}

enum TranscriptionSession {
    static func run(
        localeIdentifier: String,
        sampleRate: Double,
        channels: AVAudioChannelCount,
        writer: JSONLineWriter
    ) async throws {
        guard SpeechTranscriber.isAvailable else { throw HelperCommandError.unavailable }
        guard let locale = await SpeechTranscriber.supportedLocale(
            equivalentTo: Locale(identifier: localeIdentifier)
        ) else { throw HelperCommandError.unsupportedLocale }
        let transcriber = SpeechTranscriber(
            locale: locale,
            preset: .timeIndexedProgressiveTranscription
        )
        guard await AssetInventory.status(forModules: [transcriber]) == .installed else {
            throw HelperCommandError.unavailable
        }
        guard let naturalFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: sampleRate,
            channels: channels,
            interleaved: true
        ), let analyzerFormat = await SpeechAnalyzer.bestAvailableAudioFormat(
            compatibleWith: [transcriber],
            considering: naturalFormat
        ) else { throw HelperCommandError.invalidAudioFormat }

        let converter = try PCMInputConverter(
            sampleRate: sampleRate,
            channels: channels,
            analyzerFormat: analyzerFormat
        )
        let (inputs, continuation) = AsyncStream<AnalyzerInput>.makeStream()
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        try await analyzer.prepareToAnalyze(in: analyzerFormat)
        try await analyzer.start(inputSequence: inputs)
        let eventCoordinator = TranscriptEventCoordinator(writer: writer)
        let resultsTask = Task {
            for try await result in transcriber.results {
                let observation = TranscriptObservation(
                    text: String(result.text.characters),
                    startSeconds: CMTimeGetSeconds(result.range.start),
                    endSeconds: CMTimeGetSeconds(result.range.end),
                    finalizationSeconds: CMTimeGetSeconds(result.resultsFinalizationTime),
                    isFinal: result.isFinal
                )
                await eventCoordinator.consume(observation)
            }
        }
        writer.write(
            type: "ready",
            payload: TranscriptionReadyPayload(
                locale: locale.identifier,
                sampleRate: analyzerFormat.sampleRate,
                channels: analyzerFormat.channelCount
            )
        )

        let bytesPerFrame = Int(converter.sourceFormat.streamDescription.pointee.mBytesPerFrame)
        var pendingAudio = Data()
        while let data = try FileHandle.standardInput.read(upToCount: 64 * 1024), !data.isEmpty {
            pendingAudio.append(data)
            let completeByteCount = pendingAudio.count - pendingAudio.count % bytesPerFrame
            guard completeByteCount > 0 else { continue }
            let completeAudio = pendingAudio.prefix(completeByteCount)
            pendingAudio.removeFirst(completeByteCount)
            let buffer = try converter.convert(Data(completeAudio))
            continuation.yield(AnalyzerInput(buffer: buffer))
        }
        guard pendingAudio.isEmpty else { throw HelperCommandError.invalidAudioFormat }
        continuation.finish()
        try await analyzer.finalizeAndFinishThroughEndOfInput()
        _ = try await resultsTask.value
        await eventCoordinator.finalizeRemaining()
    }
}
