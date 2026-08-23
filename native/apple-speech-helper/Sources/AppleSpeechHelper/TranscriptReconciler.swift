import Foundation

struct TranscriptObservation: Equatable {
    let text: String
    let startSeconds: Double
    let endSeconds: Double
    let finalizationSeconds: Double
    let isFinal: Bool
}

struct TranscriptEvent: Equatable, Encodable {
    let phase: String
    let id: Int
    let text: String?
    let startSeconds: Double?
    let endSeconds: Double?
}

final class TranscriptReconciler {
    private struct Segment {
        let id: Int
        var text: String
        var start: Double
        var end: Double
        var isFinal: Bool
    }

    private var segments: [Segment] = []
    private var nextID = 0

    func consume(_ observation: TranscriptObservation) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        let matchingIndex = segments.indices.last(where: {
            !segments[$0].isFinal && rangesMatch(segments[$0], observation)
        })

        if observation.text.isEmpty {
            if let matchingIndex {
                let segment = segments.remove(at: matchingIndex)
                events.append(TranscriptEvent(
                    phase: "revoke",
                    id: segment.id,
                    text: nil,
                    startSeconds: nil,
                    endSeconds: nil
                ))
            }
        } else if let matchingIndex {
            segments[matchingIndex].text = observation.text
            segments[matchingIndex].start = observation.startSeconds
            segments[matchingIndex].end = observation.endSeconds
            if observation.isFinal {
                segments[matchingIndex].isFinal = true
            }
            events.append(event(for: segments[matchingIndex]))
        } else {
            let segment = Segment(
                id: nextID,
                text: observation.text,
                start: observation.startSeconds,
                end: observation.endSeconds,
                isFinal: observation.isFinal
            )
            nextID += 1
            segments.append(segment)
            events.append(event(for: segment))
        }

        for index in segments.indices where
            !segments[index].isFinal &&
            segments[index].end <= observation.finalizationSeconds {
            segments[index].isFinal = true
            events.append(event(for: segments[index]))
        }
        return deduplicate(events)
    }

    func finalizeRemaining() -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        for index in segments.indices where !segments[index].isFinal {
            segments[index].isFinal = true
            events.append(event(for: segments[index]))
        }
        return events
    }

    private func rangesMatch(_ segment: Segment, _ observation: TranscriptObservation) -> Bool {
        let overlaps = max(segment.start, observation.startSeconds) <
            min(segment.end, observation.endSeconds)
        return overlaps || abs(segment.start - observation.startSeconds) <= 0.25
    }

    private func event(for segment: Segment) -> TranscriptEvent {
        TranscriptEvent(
            phase: segment.isFinal ? "final" : "partial",
            id: segment.id,
            text: segment.text,
            startSeconds: segment.start,
            endSeconds: segment.end
        )
    }

    private func deduplicate(_ events: [TranscriptEvent]) -> [TranscriptEvent] {
        var result: [TranscriptEvent] = []
        for event in events {
            if result.last == event { continue }
            if let index = result.lastIndex(where: { $0.id == event.id }),
               result[index].phase == "partial", event.phase == "final" {
                result[index] = event
            } else {
                result.append(event)
            }
        }
        return result
    }
}
