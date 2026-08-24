class SharedData:
    def __init__(self):
        self.status = "running"
        self.debug_mode = False

    def set_debug_mode(self, enabled: bool) -> None:
        self.debug_mode = enabled

shared_data = SharedData()
