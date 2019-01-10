import {ClusterSelectMode} from '../models/cluster.model';
import {ComputationModel} from '../models/computation.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {stringDistance} from 'codelyzer/util/utils';

export class ElasticsearchBaseQueryDao {
    getBaseQueryString(case_name, clusters, additional_filters, graph_filter) {
        const must_tags: string[] = [];
        const must_filters: string[] = [];
        const must_not_tags: string[] = [];
        const must_not_filters: string[] = [];

        if (clusters != null && clusters !== undefined) {
            const subClusters = this.getBaseClusters(clusters);
            for (const cluster of subClusters) {
                if (cluster.selectMode !== ClusterSelectMode.notSelected) {
                    if (cluster.selectMode === ClusterSelectMode.added) {
                        if (cluster.tagged) {
                            must_tags.push(cluster.tag);

                        } else {
                            if (cluster.computation.isSelected) {
                                const filter = this.getComputationFilterString(cluster.computation);
                                if (filter != null && filter !== undefined) {
                                    must_filters.push(filter);
                                }
                            }
                        }
                    }
                    if (cluster.selectMode === ClusterSelectMode.deducted) {
                        if (cluster.tagged) {
                            must_not_tags.push(cluster.tag);
                        } else {
                            if (cluster.computation.isSelected) {
                                const filter = this.getComputationFilterString(cluster.computation);
                                if (filter != null && filter !== undefined) {
                                    must_not_filters.push(filter);
                                }
                            }
                        }
                    }
                }
            }

        }

        const must_clusters: string[] = [];
        must_clusters.push(...this.getMatchStringFromTags(must_tags));
        must_clusters.push(...must_filters);

        const must_not_clusters: string[] = [];
        must_not_clusters.push(...this.getMatchStringFromTags(must_not_tags));
        must_not_clusters.push(...must_not_filters);

        // Must params, case_name, graph_filter (if available), additional_filter (if available)
        const must_params: string[] = [];
        must_params.push(this.getMatchStringFromCase(case_name));
        if (additional_filters !== undefined) {
            must_params.push(...additional_filters);
        }
        if (graph_filter !== undefined && graph_filter !== null) {
            must_params.push(graph_filter);
        }


        // if must clusters are empty, don't display anything
        if (must_clusters.length === 0) {
            must_not_clusters.push('{"match_all": {}}');
        }


        let query = '';
        query += '"query": {'; // start of query
        query += '"bool": {'; // start of bool in query
        query += '"must": ['; // start of main must

        // must params
        query += '{'; // start of item with case selection
        query += '"bool": {'; // start bool in case selection
        query += '"must": ['; // start of must array in case selection

        if (must_params != null && must_params !== undefined) {
            if (must_params.length > 0) {
                for (let i = 0; i < must_params.length; i++) {
                    query += must_params[i];

                    if (i < (must_params.length - 1)) {
                        query += ','; // seperator between selected params
                    }
                }
            }
        }

        query += ']'; // end of must array in case selection
        query += '}'; // end of bool in case selection
        query += '}'; // end of item with case selection

        query += ','; // seperator between case selection and selected clusters

        query += '{'; // start of selected clusters
        query += '"bool" : {'; // start of bool in selected clusters
        query += '"should": ['; // start of should array of selected clusters

        if (must_clusters != null && must_clusters !== undefined) {
            if (must_clusters.length > 0) {
                for (let i = 0; i < must_clusters.length; i++) {
                    query += must_clusters[i];

                    if (i < (must_clusters.length - 1)) {
                        query += ','; // seperator between selected clusters
                    }
                }
            }
        }

        query += ']'; // end of should array in selected clusters
        query += '}'; // end of bool in selected clusters
        query += '}'; // end of selected clusters

        query += ','; // seperator between selected clusters and minus clusters

        query += '{'; // start of substracted clusters
        query += '"bool": {'; // start of bool in substracted clusters
        query += '"must_not": ['; // start of must_not array of substracted clusters

        if (must_not_clusters != null && must_not_clusters !== undefined) {
            if (must_not_clusters.length > 0) {
                for (let i = 0; i < must_not_clusters.length; i++) {
                    query += must_not_clusters[i];

                    if (i < (must_not_clusters.length - 1)) {
                        query += ','; // seperator between selected clusters
                    }
                }
            }
        }

        query += ']'; // end of must_not array of substracted clusters
        query += '}'; // end of bool in substracted clusters
        query += '}'; // end of substracted clusters

        query += ']'; // end of first must
        query += '}'; // end of first bool
        query += '}'; // end of query

        return query;
    }

    getBaseQueryClusterCountString(case_name, cluster, additional_filters) {
        const must_tags: string[] = [];
        const must_filters: string[] = [];
        const must_not_tags: string[] = [];
        const must_not_filters: string[] = [];

        if (cluster != null && cluster !== undefined) {
            const subClusters = this.getBaseClusters([cluster]);
            for (const oneCluster of subClusters) {
                if (oneCluster.tagged) {
                    must_tags.push(oneCluster.tag);

                } else {
                    const filter = this.getComputationFilterString(oneCluster.computation);
                    if (filter != null && filter !== undefined) {
                        must_filters.push(filter);
                    }
                }
            }

        }

        const must_clusters: string[] = [];
        must_clusters.push(...this.getMatchStringFromTags(must_tags));
        must_clusters.push(...must_filters);

        const must_not_clusters: string[] = [];
        must_not_clusters.push(...this.getMatchStringFromTags(must_not_tags));
        must_not_clusters.push(...must_not_filters);

        // Must params, case_name, graph_filter (if available), additional_filter (if available)
        const must_params: string[] = [];
        must_params.push(this.getMatchStringFromCase(case_name));
        if (additional_filters !== undefined) {
            must_params.push(...additional_filters);
        }


        // if must clusters are empty, don't display anything
        if (must_clusters.length === 0) {
            must_not_clusters.push('{"match_all": {}}');
        }


        let query = '';
        query += '"query": {'; // start of query
        query += '"bool": {'; // start of bool in query
        query += '"must": ['; // start of main must

        // must params
        query += '{'; // start of item with case selection
        query += '"bool": {'; // start bool in case selection
        query += '"must": ['; // start of must array in case selection

        if (must_params != null && must_params !== undefined) {
            if (must_params.length > 0) {
                for (let i = 0; i < must_params.length; i++) {
                    query += must_params[i];

                    if (i < (must_params.length - 1)) {
                        query += ','; // seperator between selected params
                    }
                }
            }
        }

        query += ']'; // end of must array in case selection
        query += '}'; // end of bool in case selection
        query += '}'; // end of item with case selection

        query += ','; // seperator between case selection and selected clusters

        query += '{'; // start of selected clusters
        query += '"bool" : {'; // start of bool in selected clusters
        query += '"should": ['; // start of should array of selected clusters

        if (must_clusters != null && must_clusters !== undefined) {
            if (must_clusters.length > 0) {
                for (let i = 0; i < must_clusters.length; i++) {
                    query += must_clusters[i];

                    if (i < (must_clusters.length - 1)) {
                        query += ','; // seperator between selected clusters
                    }
                }
            }
        }

        query += ']'; // end of should array in selected clusters
        query += '}'; // end of bool in selected clusters
        query += '}'; // end of selected clusters

        query += ','; // seperator between selected clusters and minus clusters

        query += '{'; // start of substracted clusters
        query += '"bool": {'; // start of bool in substracted clusters
        query += '"must_not": ['; // start of must_not array of substracted clusters

        if (must_not_clusters != null && must_not_clusters !== undefined) {
            if (must_not_clusters.length > 0) {
                for (let i = 0; i < must_not_clusters.length; i++) {
                    query += must_not_clusters[i];

                    if (i < (must_not_clusters.length - 1)) {
                        query += ','; // seperator between selected clusters
                    }
                }
            }
        }

        query += ']'; // end of must_not array of substracted clusters
        query += '}'; // end of bool in substracted clusters
        query += '}'; // end of substracted clusters

        query += ']'; // end of first must
        query += '}'; // end of first bool
        query += '}'; // end of query

        return query;
    }

    getComputationFilterString(computation: ComputationModel) {
        const appliedFilters = [];
        let filter: FilterModel;
        for (filter of Array.from(computation.filters)) {
            if (filter.isSelected) {
                appliedFilters.push(this.applyFilter(filter.json, filter.params));
            }
        }
        return this.getAdditionalFilterCombination(appliedFilters);
    }


    applyFilter(filter: string, params: FilterParamModel[]) {
        let result = filter;
        for (const param of params) {
            let escaped_param = param.value;
            if (param.type === 'REGEX') {
                escaped_param = escaped_param.replace(/\\/g, '\\\\');
            }
            result = result.replace('${{' + param.name + '}}$', escaped_param);
        }
        return result;
    }


    // Join additional filter with all filters
    getAdditionalFilterCombination(filters: string[]) {
        if (filters.length > 0) {
            let result = '';
            result = '{"bool": {"must":[';
            result += filters.join(', ');
            result += ']}}';
            return result;
        }

        return null;
    }


    getGraphFilterFromMactimeType(mactime_type: string) {
        if (mactime_type == null) {
            return null;
        }
        let query = '';
        query += '{';
        query += '"match": {';
        query += '"Type": "' + mactime_type + '"';
        query += '}';
        query += '}';

        return query;
    }


    getMatchStringFromTags(clusters: string[]) {
        const result = [];

        for (let i = 0; i < clusters.length; i++) {
            let query = '';
            query += '{'; // start of cluster substracted selection
            query += '"match": {'; // start of match in cluster substracted selection
            query += '"tags.keyword": "' + clusters[i] + '"';
            query += '}'; // end of match in cluster substracted selection
            query += '}'; // end of cluster substracted selection

            result.push(query);

        }
        return result;
    }


    getMatchStringFromCase(case_name: string) {
        let query = '';
        query += '{'; // start of match
        query += '"match": {'; // start of match in case selection
        query += '"case.keyword": "' + case_name + '"';
        query += '}'; // end of match in case selection
        query += '}'; // end of match

        return query;

    }


    private getBaseClusters(clusters) {
        const result = [];
        if (clusters != null && clusters !== undefined) {
            let tmp_clusters = [];
            let tmp = [];
            tmp_clusters.push(...clusters);
            let found_subClusters = false;
            do {
                found_subClusters = false;
                for (const cluster of tmp_clusters) {
                    if (cluster.subClusters.length > 0) {
                        for (const sub of cluster.subClusters) {
                            tmp.push(sub);
                        }
                        found_subClusters = true;
                    } else {
                        result.push(cluster);
                    }
                }
                tmp_clusters = tmp;
                tmp = [];
            } while (found_subClusters);
        }
        return result;
    }

    getFilterCombination(filters: string[]) {
        let result = filters[0];
        for (let i = 1; i < filters.length; i++) {
            result = result + ', ' + filters[i];
        }
        // for (const filter of filters) {
        //   result = result + ', ' + filter;
        // }
        return result;
    }

    buildShouldMatchFilter(params: string[], values: string[]) {
        if (params.length !== values.length) {
            return '';
        }
        let filter = '{"bool": {' +
            '"should": [';
        for (let index = 0; index < params.length; index++) {
            filter += '{"match": {' +
                '"' + params[index] + '": "' + values[index] + '" }}';
            if (index < (params.length - 1)) {
                filter += ',';
            }
        }
        filter += ']}}';
        return filter;
    }

    buildMustMatchFilter(params: string[], values: string[]) {
        if (params.length !== values.length) {
            return '';
        }
        let filter = '{"bool": {' +
            '"must": [';
        for (let index = 0; index < params.length; index++) {
            filter += '{"match": {' +
                '"' + params[index] + '": "' + values[index] + '" }}';
            if (index < (params.length - 1)) {
                filter += ',';
            }
        }
        filter += ']}}';
        return filter;
    }

    // buildAdditionSearchFilter(searchString: string) {
    //   return '{"multi_match": {' +
    //       '"query": "' + searchString + '",' +
    //       '"fields": ["File Name", "Size"]' +
    //     '}}';
    // }

    buildAdditionSearchFilter(searchString: string) {
        let search = searchString
            .replace('/', '\\\\/')
            .replace('.', '\\\\.')
            .replace('-', '\\\\-')
            .replace('(', '\\\\(')
            .replace(')', '\\\\)')
            .replace('[', '\\\\[')
            .replace(']', '\\\\]')
            .replace('*', '\\\\*')
            .replace('+', '\\\\+')
            .replace('{', '\\\\{')
            .replace('}', '\\\\}')
            .replace('^', '\\\\^')
            .replace('?', '\\\\?')
            .replace('<', '\\\\<')
            .replace('>', '\\\\>')
            .replace('&', '\\\\&')
            .replace('$', '\\\\$')
            .replace('|', '\\\\|');
        search = '.*' + search + '.*';
        console.log('search string:', search);
        return '{"regexp": {' +
            '"File Name.keyword": "' + search + '"' +
            '}}';
    }

    buildAdditionRangeFilter(from: string, to: string) {
        let filter = '{"range": {' +
            '"@timestamp": {';
        if (from != null && from !== undefined) {
            filter += '"gte": "' + from + '",';
            // if (to != null && to !== undefined) {
            //     filter += ',';
            // }
        }
        if (to != null && to !== undefined) {
            filter += '"lte": "' + to + '",';
        }
        filter += '"format": "date_time"';
        filter += '}' +
            '}' +
            '}';
        return filter;
    }

    buildAdditionMactimeTypeFilter(mactimes: string[]) {

        let filter = '{"bool": {' +
            '"should": [';
        for (let index = 0; index < mactimes.length; index++) {
            filter += '{"wildcard":';
            filter += '{';
            filter += '"Type.keyword":"*' + mactimes[index] + '*"';
            filter += '}';
            filter += '}';

            if (index < (mactimes.length - 1)) {
                filter += ',';
            }
        }
        filter += ']}}';

        return filter;
    }


}
