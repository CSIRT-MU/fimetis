import sys
import csv
import datetime
import argparse

# FLS header
# MD5 | name | inode | mode_as_string | UID | GID | size | atime | mtime | ctime | crtime

# FIND FROM LIFT
# mtime, atime, ctime, mode, user, group, name
# do_command "find /dev/shm/mount_ro -xdev -print0 | xargs -0 stat -c '%Y %X %Z %A %U %G %s %n'"


class Entry():
    """
    Structure that represents one single fls entry
    """
    def __init__(self):
        self.md5 = '0'
        self.file_name = ''
        self.meta = '0'
        self.mode = ''
        self.uid = 1
        self.gid = 1
        self.size = 0
        self.atime = 0
        self.mtime = 0
        self.ctime = 0
        self.btime = 0

    def __iter__(self):
        return iter([self.md5, self.file_name, self.meta, self.mode, self.uid, self.gid, self.size, self.atime,
                     self.mtime, self.ctime, self.btime])


def process(input_file):
    """
    function that process entries from find input file to fls format
    :param input_file: path to input file
    :return:
    """
    entries = list()
    with open(input_file, 'r', errors='ignore') as file_stream:
        line = csv.reader(file_stream, delimiter=' ', quotechar='"')
        for row in line:
            tmp_entry = Entry()
            tmp_entry.file_name = row[7]
            tmp_entry.mode = row[3]
            tmp_entry.size = row[6]

            if row[4] == 'root':
                tmp_entry.uid = 0

            if row[5] == 'root':
                tmp_entry.gid = 0

            tmp_entry.atime = row[1]
            tmp_entry.mtime = row[0]
            tmp_entry.ctime = row[2]

            entries.append(tmp_entry)

    return entries


def export_fls(entries, output_file):
    """
    function that takes the list of fls entries and exports them to fls output file
    :param entries: list of fls entries
    :param output_file: path to output file
    :return:
    """
    with open(output_file, 'w', newline='') as file_stream:
        wr = csv.writer(file_stream, delimiter='|', quotechar='"')
        for line in entries:
            wr.writerow(line)


def main():
    parser = argparse.ArgumentParser(description='Convert disc timestamps from find format to fls')
    parser.add_argument('--input_file', required=True, help='Path to input file')
    parser.add_argument('--output_file', required=True, help='Path to future output file')

    args = parser.parse_args()

    entries = process(args.input_file)
    export_fls(entries, args.output_file)


if __name__ == '__main__':
    main()
