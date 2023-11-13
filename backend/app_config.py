import configparser

section = 'fimetis'

app_defaults = {
    'db_name': 'fimetis',
    'db_user': 'fimetis',
    'ext_user_group_urn': 'urn:geant:muni.cz:res:CSIRT-MU#idm.ics.muni.cz',
    'ext_admin_group_urn': 'urn:geant:muni.cz:res:handlingCSIRTMU#idm.ics.muni.cz',

}

class AppConfig:
    config = None

    def __init__(self, path='/etc/fimetis.conf'):
        config = configparser.ConfigParser(defaults=app_defaults)
        config.read(path)
        self.config = config

    def get_str(self, key):
        return self.config.get(section, key, fallback=app_defaults[key])

    def get_int(self, key):
        return self.config.getint(section, key, fallback=app_defaults[key])

    def get_bool(self, key):
        return self.config.getboolean(section, key, fallback=app_defaults[key])
