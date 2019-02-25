#!/bin/bash

readonly EXAMPLE="./config-generator.sh -c case-name -h elasticserver -i index -t type -u user -p password -tp /path/to/template.txt /path/to/input.txt"
readonly MACTIMES_HEADER='"Date", "Size", "Type", "Mode", "UID", "GID", "Meta", "File Name"'
readonly AGGREGATED_MACTIMES_HEADER='"Date", "Size", "Type", "Mode", "UID", "GID", "Meta", "File Name", "Prefix", "Grouped", "Group Id", "Subentries"'

POSITIONAL=()
while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    -c|--case)
    CASE="$2"
    shift # past argument
    shift # past value
    ;;
    -h|--host)
    EL_HOST="$2"
    shift # past argument
    shift # past value
    ;;
    -u|--user)
    EL_USER="$2"
    shift # past argument
    shift # past value
    ;;
    -p|--password)
    EL_PASSWORD="$2"
    shift # past argument
    shift # past value
    ;;
    -i|--index)
    INDEX="$2"
    shift # past argument
    shift # past value
    ;;
    -t|--type)
    TYPE="$2"
    shift # past argument
    shift # past value
    ;;
    -tp|--template)
    TEMPLATE="$2"
    shift # past argument
    shift # past value
    ;;
    *)    # unknown option
    POSITIONAL+=("$1") # save it in an array for later
    shift # past argument
    ;;
esac
done
set -- "${POSITIONAL[@]}" # restore positional parameters

if [ -z "$CASE" ] || [ -z "$EL_HOST" ] || [ -z "$TYPE" ] || [ -z "$INDEX" ] || [ -z "$EL_USER" ] || [ -z "$EL_PASSWORD" ] || [ -z $TEMPLATE ] || [ -z $1 ]
then
    echo "Some arguments are missing:"
    echo elastic-host -s = "${EL_HOST}"
    echo case -c = "${CASE}"
    echo type -t = "${TYPE}"
    echo elastic-user -u = "${EL_USER}"
    echo elastic-passwd -p = "${EL_PASSWORD}"
    echo index -i = "${INDEX}"
    echo "template -tp" = "${TEMPLTE}"
    echo input = "$1"
  
    echo 
    echo "Example of running this script:"
    echo $EXAMPLE
    exit 1
fi

if [ "$TYPE" != "mactimes" ] && [ "$TYPE" != "aggregated-mactimes" ]
then
    echo "Bad type of entries, only mactimes or aggregated-mactimes are supported"
    exit 1
fi

cat $TEMPLATE | sed -e "s/\${CASE}/$CASE/" | sed -e "s/\${EL_HOST}/${EL_HOST}/" | sed -e "s/\${TYPE}/${TYPE}/" | sed -e "s/\${INDEX}/${INDEX}/" \
| sed -e "s/\${EL_USER}/$EL_USER/" | sed -e "s/\${EL_PASSWORD}/${EL_PASSWORD}/" > /etc/logstash/conf.d/$CASE.conf

if [ "$TYPE" = "mactimes" ]
then
    cat "/etc/logstash/conf.d/${CASE}.conf" | sed -e "s/\${HEADER}/${MACTIMES_HEADER}/" > /etc/logstash/conf.d/$CASE.conf2
    mv /etc/logstash/conf.d/$CASE.conf2 /etc/logstash/conf.d/$CASE.conf
fi

if [ "$TYPE" = "aggregated-mactimes" ]
then
    cat /etc/logstash/conf.d/${CASE}.conf | sed -e "s/\${HEADER}/${AGGREGATED_MACTIMES_HEADER}/" > /etc/logstash/conf.d/$CASE.conf2 
    mv /etc/logstash/conf.d/$CASE.conf2 /etc/logstash/conf.d/$CASE.conf
fi


date > /tmp/$CASE.log
cat $1 | /usr/share/logstash/bin/logstash -f /etc/logstash/conf.d/$CASE.conf >> /tmp/$CASE.log
date >> /tmp/$CASE.log

