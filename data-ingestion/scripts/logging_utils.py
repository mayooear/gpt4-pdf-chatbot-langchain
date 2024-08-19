import logging
from colorama import Fore, Style, init

# Initialize colorama
init(autoreset=True)

class ColorFormatter(logging.Formatter):
    def format(self, record):
        if record.levelno == logging.WARNING:
            record.msg = f"{Fore.YELLOW}{record.msg}{Style.RESET_ALL}"
        elif record.levelno >= logging.ERROR:
            record.msg = f"{Fore.RED}{record.msg}{Style.RESET_ALL}"
        return super().format(record)

def configure_logging(debug=False):
    root_logger = logging.getLogger()
    if not root_logger.handlers:  # Only add handler if none exist
        formatter = ColorFormatter("%(asctime)s - %(levelname)s - %(message)s")
        handler = logging.StreamHandler()
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)
    
    root_logger.setLevel(logging.DEBUG if debug else logging.INFO)

    # Configure specific loggers
    loggers_to_adjust = [
        "openai",
        "httpx",
        "httpcore",
        "boto3",
        "botocore",
        "urllib3",
        "s3transfer",
        "subprocess",
        "libavcodec",
        "libavformat",
        "libavdevice",
        "libavfilter",
        "libswscale",
        "libswresample",
        "libpostproc",
    ]
    for logger_name in loggers_to_adjust:
        logging.getLogger(logger_name).setLevel(
            logging.INFO if debug else logging.WARNING
        )