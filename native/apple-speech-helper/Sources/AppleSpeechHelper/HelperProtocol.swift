import Foundation

enum HelperProtocol {
    static let version = 1
}

struct HelperEnvelope<Payload: Encodable>: Encodable {
    let protocolVersion = HelperProtocol.version
    let type: String
    let payload: Payload
}

struct HelperErrorPayload: Encodable {
    let code: String
    let errorType: String
}

final class JSONLineWriter: @unchecked Sendable {
    private let lock = NSLock()
    private let encoder = JSONEncoder()

    func write<Payload: Encodable>(type: String, payload: Payload) {
        lock.lock()
        defer { lock.unlock() }
        do {
            var data = try encoder.encode(HelperEnvelope(type: type, payload: payload))
            data.append(0x0A)
            FileHandle.standardOutput.write(data)
        } catch {
            FileHandle.standardError.write(
                Data("Unable to encode helper output (\(Swift.type(of: error))).\n".utf8)
            )
        }
    }

    func writeError(code: String, error: Error) {
        write(
            type: "error",
            payload: HelperErrorPayload(
                code: code,
                errorType: String(describing: Swift.type(of: error))
            )
        )
    }
}

enum HelperCommandError: Error {
    case invalidArguments
    case unsupportedLocale
    case unavailable
    case invalidAudioFormat
}
