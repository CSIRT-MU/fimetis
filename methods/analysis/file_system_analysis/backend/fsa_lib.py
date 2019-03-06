from enum import Enum
import re


class ClusterModel:
    def __init__(self):
        self.name = ''
        self.count = 0
        self.computation = ComputationModel()
        self.tagged = False
        self.tag = ''
        self.selectMode = ClusterSelectMode.notSelected
        self.subClusters = []


class ClusterSelectMode(Enum):
    notSelected = 0
    added = 1
    deducted = 2


class ComputationModel:
    def __init__(self):
        self.name = ''
        self.filters = []
        self.isSelected = True


class FilterModel:
    def __init__(self):
        self.name = ''
        self.type = ''
        self.json = ''
        self.params = []
        self.completed = ''
        self.isSelected = ''


class FilterParamModel:
    def __init__(self):
        self.name = ''
        self.type = ''
        self.value = ''


def build_data_query(case_name,
                     clusters,
                     additional_filters,
                     graph_filter,
                     from_param,
                     size=0,
                     sort='timestamp',
                     sort_order='asc'):
        query = '{'  # start of all query string
        query += '"from": ' + str(from_param)
        query += ',' # separator between from_param and size
        query += '"size": ' + str(size)
        query += ',' # separator between size and query

        query += build_base_query(
            case_name,
            clusters,
            additional_filters,
            graph_filter)

        query += ','  # separator between query and sort
        query += '"sort": ['  # begin of sort field
        query += '{'  # begin of sort parametr

        if sort is 'timestamp':
            query += '"@timestamp": '
        elif sort is 'name':
            query += '"File Name.keyword": '
        elif sort is 'size':
            query += '"Size.keyword": '
        elif sort is 'type':
            query += '"Type.keyword": '
        else:
            query += '"@timestamp": '
        query += '{'  # begin of sort order
        query += '"order": "' + sort_order + '"'  # Adding sorting order
        query += '}'  # end of sorting order
        query += '}'  # end of sort parametr
        query += ']'  # end of sort field
        query += '}'  # end of all string
        return query


def build_base_query(case_name, clusters, additional_filters, graph_filter):
    must_tags = []
    must_filters = []
    must_not_tags = []
    must_not_filters = []

    if clusters is not None:
        sub_clusters = get_base_clusters(clusters)
        for cluster in sub_clusters:
            if cluster.selectMode is not ClusterSelectMode.notSelected:
                if cluster.selectMode is ClusterSelectMode.added:
                    if cluster.tagged:
                        must_tags.append(cluster.tag)
                    else:
                        if cluster.computation.isSelected:
                            filter_model = get_computation_filter_string(cluster.computation)
                            if filter_model is not None:
                                must_filters.append(filter_model)
                if cluster.selectMode is ClusterSelectMode.deducted:
                    if cluster.tagged:
                        must_not_tags.append(cluster.tag)
                    else:
                        if cluster.computation.isSelected:
                            filter_model = get_computation_filter_string(cluster.computation)
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
        must_params.extend(additional_filters)
    if graph_filter is not None:
        must_params.append(graph_filter)

    # if must clusters are empty, don't display anything
    if len(must_clusters) == 0:
        must_not_clusters.append('{"match_all": {}}')

    query = ''
    query += '"query": {'  # start of query
    query += '"bool": {'   # start of bool in query
    query += '"must": ['   # start of main must

    # must params
    query += '{'  # start of item with case selection
    query += '"bool": {'  # start bool in case selection
    query += '"must": ['  # start of must array in case selection

    if must_params is not None:
        if len(must_params) > 0:
            for i in range(0, len(must_params)):
                query += str(must_params[i])
                if i < (len(must_params) - 1):
                    query += ','  # separator between selected params

    query += ']'  # end of must array in case selection
    query += '}'  # end of bool in case selection
    query += '}'  # end of item with case selection

    query += ','  # separator between case selection and selected clusters

    query += '{'  # start of selected clusters
    query += '"bool" : {'  # start of bool in selected clusters
    query += '"should": ['  # start of should array of selected clusters

    if must_clusters is not None:
        if len(must_clusters) > 0:
            for i in range(0, len(must_clusters)):
                query += str(must_clusters[i])
                if i < (len(must_clusters) - 1):
                    query += ','  # separator between selected clusters

    query += ']'  # end of should array in selected clusters
    query += '}'  # end of bool in selected clusters
    query += '}'  # end of selected clusters

    query += ',' # separator between selected clusters and minus clusters

    query += '{'  # start of substracted clusters
    query += '"bool": {'  # start of bool in substracted clusters
    query += '"must_not": ['  # start of must_not array of substracted clusters

    if must_not_clusters is not None:
        if len(must_not_clusters) > 0:
            for i in range(0, len(must_not_clusters)):
                query += str(must_not_clusters[i])
                if i < (len(must_not_clusters) - 1):
                    query += ','  # separator between selected clusters

    query += ']'  # end of must_not array of substracted clusters
    query += '}'  # end of bool in substracted clusters
    query += '}'  # end of substracted clusters

    query += ']'  # end of first must
    query += '}'  # end of first bool
    query += '}'  # end of query

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
                if len(cluster.subClusters) > 0:
                    for sub in cluster.subClusters:
                        tmp.append(sub)
                        found_sub_clusters = True
                else:
                    result.append(cluster)
            tmp_clusters = tmp
            tmp = []
            if not found_sub_clusters:
                break
    return result


def get_computation_filter_string(computation):
    applied_filters = []
    for filter_model in computation.filters:
        if filter_model.isSelected:
            applied_filters.append(apply_filter(filter_model.json, filter_model.params))
    return get_additional_filter_combination(applied_filters)


def apply_filter(filter_model, params):
    result = filter_model
    for param in params:
        escaped_param = param.value
        if param.type is 'REGEX':
            escaped_param = re.sub(r'/\\/', '\\\\', escaped_param)
        result = result.replace('${{' + param.name + '}}$', escaped_param)
    return result


def get_additional_filter_combination(filters):
    if len(filters) > 0:
        result = '{"bool": {"must":['
        result += filters.join(', ')
        result += ']}}'
        return result
    return None


def get_match_string_from_tags(clusters):
    result = []
    for i in range(0, len(clusters)):
        query = ''
        query += '{'
        query += '"match": {'
        query += '"tags.keyword": "' + clusters[i] + '"'
        query += '}'
        query += '}'
        result.append(query)
    return result


def get_match_string_from_case(case_name):
    query = ''
    query += '{'
    query += '"match": {'
    query += '"case.keyword": "' + case_name + '"'
    query += '}'
    query += '}'
    return query
