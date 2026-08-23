import AVFoundation
import Darwin
import Foundation

@main
enum AppleSpeechHelperMain {
    static func main() async {
        let writer = JSONLineWriter()
        do {
            guard #available(macOS 26.0, *) else {
                throw HelperCommandError.unavailable
            }
            let arguments = Array(CommandLine.arguments.dropFirst())
            guard let command = arguments.first else {
                throw HelperCommandError.invalidArguments
            }
            switch command {
            case "probe":
                writer.write(type: "capability", payload: await CapabilityProbe.run())
            case "model-status":
                let locale = try argument(named: "--locale", in: arguments)
                writer.write(
                    type: "model-status",
                    payload: await ModelAssetService.status(localeIdentifier: locale)
                )
            case "model-install":
                let locale = try argument(named: "--locale", in: arguments)
                try await ModelAssetService.install(localeIdentifier: locale, writer: writer)
            case "model-release":
                let locale = try argument(named: "--locale", in: arguments)
                writer.write(
                    type: "model-status",
                    payload: await ModelAssetService.release(localeIdentifier: locale)
                )
            case "transcribe":
                let locale = try argument(named: "--locale", in: arguments)
                guard let sampleRate = Double(try argument(named: "--sample-rate", in: arguments)),
                      let channels = UInt32(try argument(named: "--channels", in: arguments)),
                      sampleRate > 0, channels > 0 else {
                    throw HelperCommandError.invalidArguments
                }
                try await TranscriptionSession.run(
                    localeIdentifier: locale,
                    sampleRate: sampleRate,
                    channels: channels,
                    writer: writer
                )
            default:
                throw HelperCommandError.invalidArguments
            }
        } catch {
            writer.writeError(code: errorCode(error), error: error)
            exit(1)
        }
    }

    private static func argument(named name: String, in arguments: [String]) throws -> String {
        guard let index = arguments.firstIndex(of: name),
              arguments.indices.contains(index + 1) else {
            throw HelperCommandError.invalidArguments
        }
        return arguments[index + 1]
    }

    private static func errorCode(_ error: Error) -> String {
        guard let commandError = error as? HelperCommandError else { return "operation-failed" }
        return switch commandError {
        case .invalidArguments: "invalid-arguments"
        case .unsupportedLocale: "unsupported-locale"
        case .unavailable: "unavailable"
        case .invalidAudioFormat: "invalid-audio-format"
        }
    }
}
