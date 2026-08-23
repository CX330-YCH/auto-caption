import XCTest
@testable import AppleSpeechHelper

final class TranscriptReconcilerTests: XCTestCase {
    func testPartialBecomesFinalThroughWatermarkWithoutFinalReplay() {
        let reconciler = TranscriptReconciler()
        let partial = reconciler.consume(TranscriptObservation(
            text: "hello",
            startSeconds: 0,
            endSeconds: 1,
            finalizationSeconds: 0,
            isFinal: false
        ))
        XCTAssertEqual(partial, [TranscriptEvent(
            phase: "partial", id: 0, text: "hello", startSeconds: 0, endSeconds: 1
        )])

        let next = reconciler.consume(TranscriptObservation(
            text: "world",
            startSeconds: 1.1,
            endSeconds: 2,
            finalizationSeconds: 1.1,
            isFinal: false
        ))
        XCTAssertTrue(next.contains(TranscriptEvent(
            phase: "final", id: 0, text: "hello", startSeconds: 0, endSeconds: 1
        )))
    }

    func testVolatileEmptyTextRevokesExistingSegment() {
        let reconciler = TranscriptReconciler()
        _ = reconciler.consume(TranscriptObservation(
            text: "wrong", startSeconds: 0, endSeconds: 1,
            finalizationSeconds: 0, isFinal: false
        ))
        let events = reconciler.consume(TranscriptObservation(
            text: "", startSeconds: 0, endSeconds: 1,
            finalizationSeconds: 0, isFinal: false
        ))
        XCTAssertEqual(events, [TranscriptEvent(
            phase: "revoke", id: 0, text: nil, startSeconds: nil, endSeconds: nil
        )])
    }

    func testFinalResultKeepsPartialIdentity() {
        let reconciler = TranscriptReconciler()
        _ = reconciler.consume(TranscriptObservation(
            text: "hel", startSeconds: 0, endSeconds: 0.7,
            finalizationSeconds: 0, isFinal: false
        ))
        let events = reconciler.consume(TranscriptObservation(
            text: "hello", startSeconds: 0, endSeconds: 1,
            finalizationSeconds: 1, isFinal: true
        ))
        XCTAssertEqual(events, [TranscriptEvent(
            phase: "final", id: 0, text: "hello", startSeconds: 0, endSeconds: 1
        )])
    }
}
