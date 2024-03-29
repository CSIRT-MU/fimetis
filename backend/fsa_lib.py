from enum import Enum
import json


class Cluster:
    def __init__(self, dictionary=None):
        self.name = ''
        self.filters = []
        self.tagged = False
        self.tag = ''
        self.selectMode = ClusterSelectMode.notSelected
        self.subClusters = []
        if dictionary is not None and isinstance(dictionary, dict):
            self.__dict__ = dictionary


class ClusterSelectMode(Enum):
    notSelected = 0
    added = 1
    deducted = 2


class Filter:
    def __init__(self, dictionary=None):
        self.name = ''
        self.type = ''
        self.json = ''
        self.params = []
        self.isSelected = ''
        if dictionary is not None and isinstance(dictionary, dict):
            self.__dict__ = dictionary


class FilterParam:
    def __init__(self, dictionary=None):
        self.name = ''
        self.type = ''
        self.value = ''
        if dictionary is not None and isinstance(dictionary, dict):
            self.__dict__ = dictionary


def build_data_query(case_name,
                     clusters,
                     additional_filters,
                     from_param=0,
                     size=1,
                     sort='timestamp',
                     sort_order='asc'):
    body = {}
    body['from'] = from_param
    body['size'] = size
    body['query'] = build_base_query(case_name, clusters, additional_filters, None)

    sort_type = "@timestamp"
    if sort == 'timestamp':
        sort_type = "@timestamp"
    elif sort == 'name':
        sort_type = "File Name.keyword"
    elif sort == 'size':
        sort_type = "Size"
    elif sort == 'type':
        sort_type = "Type.keyword"
    elif sort == 'mode':
        sort_type = "Mode.keyword"
    elif sort == 'uid':
        sort_type = "UID"
    elif sort == 'gid':
        sort_type = "GID"
    elif sort == 'inode':
        sort_type = "Meta"

    body['sort'] = [{sort_type: {'order': sort_order}}]
    return body


def build_graph_data_query(case_name,
                           clusters,
                           additional_filters,
                           mac_type,
                           frequency):
    body = {}
    body['query'] = build_base_query(case_name, clusters, additional_filters, build_additional_type_filter(mac_type))
    body['aggs'] = {'dates': {'date_histogram': {'field': '@timestamp', 'interval': frequency}}}
    return body


def build_first_entry_query(case_name, clusters, additional_filters, mac_type, order):
    body = {}
    body['from'] = 0
    body['size'] = 1
    body['query'] = build_base_query(case_name, clusters, additional_filters, build_additional_type_filter(mac_type))
    body['sort'] = [{'@timestamp': {'order': order}}]
    return body


def build_whole_case_first_entry_query(case_name, order):
    body = {}
    body['from'] = 0
    body['size'] = 1
    body['query'] = {'bool': {'must': [get_match_string_from_case(case_name)]}}
    body['sort'] = [{'@timestamp': {'order': order}}]
    return body


def build_base_query(case_name, clusters, additional_filters, graph_filter):
    must_tags = []
    must_filters = []
    must_not_tags = []
    must_not_filters = []

    if clusters is not None:
        sub_clusters = get_base_clusters(clusters)
        for cluster in sub_clusters:
            if cluster.selectMode != ClusterSelectMode.notSelected.value:
                if cluster.selectMode == ClusterSelectMode.added.value:
                    if cluster.tagged:
                        must_tags.append(cluster.tag)
                    else:
                        filter_model = get_filter_string(cluster)
                        if filter_model is not None:
                            must_filters.append(filter_model)
                if cluster.selectMode == ClusterSelectMode.deducted.value:
                    if cluster.tagged:
                        must_not_tags.append(cluster.tag)
                    else:
                        filter_model = get_filter_string(cluster)
                        if filter_model is not None:
                            must_not_filters.append(filter_model)
    must_clusters = []
    must_clusters.extend(get_match_string_from_tags(must_tags))
    must_clusters.extend(must_filters)

    must_not_clusters = []
    must_not_clusters.extend(get_match_string_from_tags(must_not_tags))
    must_not_clusters.extend(must_not_filters)

    # Must params, case_name, graph_filter( if available), additional_filter( if available)
    must_params = []
    must_params.append(get_match_string_from_case(case_name))
    if additional_filters is not None:
        filter_array = parse_additional_filters(additional_filters)
        for add_filt in filter_array:
            must_params.append(add_filt)

    if graph_filter is not None:
        must_params.append(graph_filter)

    # if must clusters are empty, don't display anything
    if len(must_clusters) == 0:
        must_not_clusters.append({'match_all': {}})

    query_must_params = {'bool': {'must': must_params}}
    query_should_clusters = {'bool': {'should': must_clusters}}
    query_must_not_clusters = {'bool': {'must_not': must_not_clusters}}
    query = {'bool': {'must': [query_must_params, query_should_clusters, query_must_not_clusters]}}

    return query


def build_count_query(case_name, cluster, additional_filters):
    must_tags = []
    must_filters = []
    must_not_tags = []
    must_not_filters = []
    if cluster is not None:
        sub_clusters = get_base_clusters([cluster])
        for cluster in sub_clusters:
            if cluster.tagged:
                must_tags.append(cluster.tag)
            else:
                filter_model = get_filter_string(cluster)
                if filter_model is not None:
                    must_filters.append(filter_model)

    must_clusters = []
    must_clusters.extend(get_match_string_from_tags(must_tags))
    must_clusters.extend(must_filters)

    must_not_clusters = []
    must_not_clusters.extend(get_match_string_from_tags(must_not_tags))
    must_not_clusters.extend(must_not_filters)

    # Must params, case_name, graph_filter( if available), additional_filter( if available)
    must_params = []
    must_params.append(get_match_string_from_case(case_name))
    if additional_filters is not None:
        filter_array = parse_additional_filters(additional_filters)
        for add_filt in filter_array:
            must_params.append(add_filt)

    # if must clusters are empty, don't display anything
    if len(must_clusters) == 0:
        must_not_clusters.append({'match_all': {}})

    query_must_params = {'bool': {'must': must_params}}
    query_should_clusters = {'bool': {'should': must_clusters}}
    query_must_not_clusters = {'bool': {'must_not': must_not_clusters}}
    query = {'query': {'bool': {'must': [query_must_params, query_should_clusters, query_must_not_clusters]}}}

    return query


def get_base_clusters(clusters):
    result = []
    if clusters is not None:
        tmp_clusters = []
        tmp = []
        tmp_clusters.extend(clusters)
        while True:
            found_sub_clusters = False
            for cluster in tmp_clusters:
                cluster = Cluster(cluster)
                if len(cluster.subClusters) > 0:
                    for sub in cluster.subClusters:
                        sub = Cluster(sub)
                        tmp.append(sub)
                        found_sub_clusters = True
                else:
                    result.append(cluster)
            tmp_clusters = tmp
            tmp = []
            if not found_sub_clusters:
                break
    return result


def get_filter_string(computation):
    applied_filters = []
    for filter_model in computation.filters:
        filter_model = Filter(filter_model)
        if filter_model.isSelected:
            applied_filters.append(apply_filter(filter_model.json, filter_model.params))
    return get_additional_filter_combination(applied_filters)


def apply_filter(filter_model, params):
    result = filter_model
    for param in params:
        param = FilterParam(param)
        escaped_param = param.value
        if param.type == 'REGEX':
            escaped_param = str(escaped_param).replace('\\', '\\\\')
        result = result.replace('${{' + param.name + '}}$', escaped_param)

    return json.loads(result)


def get_additional_filter_combination(filters):
    if len(filters) > 0:
        result = {'bool': {'must': [filters]}}
        return result
    return None


def get_match_string_from_tags(clusters):
    result = []
    for i in range(0, len(clusters)):
        query = {'match': {'tags.keyword': clusters[i]}}
        result.append(query)
    return result


def get_match_string_from_case(case_name):
    query = {'match': {'case.keyword': case_name}}
    return query


def build_additional_search_filter(search_string):
    search = search_string.replace('/', '\\/')\
        .replace('.', '\\.')\
        .replace('-', '\\-')\
        .replace('(', '\\(')\
        .replace(')', '\\)')\
        .replace('[', '\\[')\
        .replace(']', '\\]')\
        .replace('*', '\\*')\
        .replace('+', '\\+')\
        .replace('{', '\\{')\
        .replace('}', '\\}')\
        .replace('^', '\\^')\
        .replace('?', '\\?')\
        .replace('<', '\\<')\
        .replace('>', '\\>')\
        .replace('&', '\\&')\
        .replace('$', '\\$')\
        .replace('|', '\\|')
    search = '.*' + search + '.*'
    return {'regexp': {'File Name.keyword': search}}


# non-used now
# def build_additional_range_filter(from_param, to_param):
#     if from_param is not None or to_param is not None:
#         time_range = {}
#         if from_param is not None:
#             time_range['gte'] = from_param
#         if to_param is not None:
#             time_range['lte'] = to_param
#         time_range['format'] = 'date_time'
#         return {'range': {'@timestamp': time_range}}
#     else:
#         return None


def build_multi_time_range_filter(select_filters):
    multiple_range_query = {}

    ranges = {}
    ranges['should'] = []
    for select_filter in select_filters:
        time_range = {}
        time_range['gte'] = select_filter[0]
        time_range['lte'] = select_filter[1]
        ranges['should'].append({'range': {'@timestamp': time_range}})

    multiple_range_query['bool'] = ranges

    return  multiple_range_query


def build_additional_types_filter(types):
    if len(types) == 0:
        return {'bool': {'should': [{'wildcard': {'Type.keyword': ''}}]}}
    filters = []
    for m_type in types:
        filters.append(build_additional_type_filter(m_type))

    return {'bool': {'should': filters}}


def build_additional_type_filter(type_param):
    if type_param is not None:
        return {'wildcard': {'Type.keyword': '*' + str(type_param) + '*'}}
    else:
        return None


def build_border_filter(time_border):
    return {'range': {'@timestamp': {'lt': time_border}}}


# Returns array of additional filters in json that are ready to join in elastic query
# Supported filters
# dict keyword - description
# searchString - filter in filename
# multiTimeRange - selection of one or more timeblocks
# timeBorder - border used for counting the position where to stay scrolled after changed of cluster
# typeFilter - filtering by selected timestamps (m, c, a, b)

def parse_additional_filters(additional_filters):
    additional_filters_obj = json.loads(additional_filters)

    if additional_filters_obj is None:
        return []

    processed_additional_filters = []
    if 'searchString' in additional_filters_obj:
        processed_additional_filters.append(build_additional_search_filter(additional_filters_obj['searchString']))

    if 'multiTimeRange' in additional_filters_obj:
        processed_additional_filters.append(build_multi_time_range_filter(additional_filters_obj['multiTimeRange']))

    if 'timeBorder' in additional_filters_obj:
        processed_additional_filters.append(build_border_filter(additional_filters_obj['timeBorder']))

    if 'typeFilter' in additional_filters_obj:
        processed_additional_filters.append(build_additional_types_filter(additional_filters_obj['typeFilter']))

    return processed_additional_filters


def build_id_presence_query(case_name, clusters, id):
    body = {}

    must_tags = []
    must_filters = []
    must_not_tags = []
    must_not_filters = []
    if clusters is not None:
        sub_clusters = get_base_clusters(clusters)
        for cluster in sub_clusters:
            if cluster.selectMode != ClusterSelectMode.notSelected.value:
                if cluster.selectMode == ClusterSelectMode.added.value:
                    if cluster.tagged:
                        must_tags.append(cluster.tag)
                    else:
                        filter_model = get_filter_string(cluster)
                        if filter_model is not None:
                            must_filters.append(filter_model)
                if cluster.selectMode == ClusterSelectMode.deducted.value:
                    if cluster.tagged:
                        must_not_tags.append(cluster.tag)
                    else:
                        filter_model = get_filter_string(cluster)
                        if filter_model is not None:
                            must_not_filters.append(filter_model)
    must_clusters = []
    must_clusters.extend(get_match_string_from_tags(must_tags))
    must_clusters.extend(must_filters)

    must_not_clusters = []
    must_not_clusters.extend(get_match_string_from_tags(must_not_tags))
    must_not_clusters.extend(must_not_filters)

    must_params = []
    must_params.append(get_match_string_from_case(case_name))

    if len(must_clusters) == 0:
        must_not_clusters.append({'match_all': {}})

    query_must_params = {'bool': {'must': must_params}}
    query_should_clusters = {'bool': {'should': must_clusters}}
    query_must_not_clusters = {'bool': {'must_not': must_not_clusters}}
    query = {'bool': {'must': [query_must_params, query_should_clusters, query_must_not_clusters]}}

    must_params.append({'ids': {'values': [id]}})
    body['query'] = query
    return body
