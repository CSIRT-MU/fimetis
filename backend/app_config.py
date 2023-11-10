import configparser

section = 'fimetis'

class AppConfig:
    config = None

    def __init__(self, path):
        config = configparser.ConfigParser()
        config.read(path)
        self.config = config

    def get_str(self, key):
        return self.config.get(section, key)

    def get_int(self, key):
        return self.config.getint(section, key)

    def get_bool(self, key):
        return self.config.getboolean(section, key)
