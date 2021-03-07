#!/usr/bin/env python3

import sys
import csv


def recognize_type(filename):
    header = ''
    with open(filename, 'r', errors='ignore') as file_stream:
        reader = csv.reader(file_stream)
        for row in reader:
            header_row = row
            break
    header = ','.join(header_row)
    columns = len(header_row)

    if header.startswith("Date,Size,Type,Mode,UID,GID,Meta,File Name"):
        return "mactime"
    elif header.startswith("date,time,timezone,MACB,source,sourcetype,type,"):
        return "l2tcsv"
    elif columns == 8:
        return "mactime_noheader"
    elif columns == 1:
        splited_header = header.split("|")
        columns = len(splited_header)
        if columns == 11:
            return "fls"
        if columns == 1:
            splited_header = header.split(" ")
            columns = len(splited_header)
            if columns == 7:
                return "find"
    else:
        return False
    return False


