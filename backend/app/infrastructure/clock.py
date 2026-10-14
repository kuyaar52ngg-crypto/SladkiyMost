from datetime import date


class SystemClock:
    def __init__(self, fixed: date | None = None):
        self.fixed = fixed

    def today(self) -> date:
        return self.fixed or date.today()
