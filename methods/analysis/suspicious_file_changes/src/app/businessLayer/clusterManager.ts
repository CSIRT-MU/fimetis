import {FilterModel} from '../models/filter.model';
import {ComputationModel} from '../models/computation.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {MetadataModel} from '../models/metadata.model';
import 'rxjs/add/operator/toPromise';
import {DataModel} from '../models/data.model';


export class ClusterManager {
    private _clusters: ClusterModel[];
    private _case: string;
    private _graph_filter: string;
    private _additional_filters: string[];

    constructor(private es: ElasticsearchService) {}

    get case(): string {
        return this._case;
    }

    set case(value: string) {
        this._case = value;
    }

    get graph_filter(): string {
        return this._graph_filter;
    }

    set graph_filter(value: string) {
        this._graph_filter = value;
    }

    get additional_filters(): string[] {
        return this._additional_filters;
    }

    set additional_filters(value: string[]) {
        this._additional_filters = value;
    }

    get clusters(): ClusterModel[] {
        return this._clusters;
    }

    set clusters(value: ClusterModel[]) {
        this._clusters = value;
    }

    getData(index, type, begin, page_size, sort, sort_order): Promise<DataModel> {
        return new Promise((resolve, reject) => {
            this.es.runQuery(index, type, this.buildQuery(begin, page_size, sort, sort_order)).then(
                response => {
                    const data = new DataModel();
                    data.data = response.hits.hits;
                    data.total = response.hits.total;
                    resolve(data);
                }, error => {
                    console.error(error);
                    reject();
                }
            );
        });
    }

    getStoredClusters(index, type): Promise<any> {
        return new Promise((resolve, reject) => {
            this.es.getTags(index, type, this.case).then(
                response => {
                    const data: Set<ClusterModel> = new Set<ClusterModel>();
                    const tags = response.aggregations.tags.buckets;
                    for (const tag of tags) {
                        const cluster = new ClusterModel();
                        cluster.tag = tag.key;
                        cluster.name = tag.key;
                        cluster.count = tag.doc_count;
                        cluster.tagged = true;
                        cluster.selectMode = ClusterSelectMode.notSelected;
                        data.add(cluster);
                    }
                    resolve(data);
                }, error => {
                    console.error(error);
                    reject();
                }
            );
        });
    }

    buildQuery(page_index, size, sort, sort_order) {
        console.log('clust', this._clusters);
        const must_tags: string[] = [];
        const must_filters: string[] = [];
        const must_not_tags: string[] = [];
        const must_not_filters: string[] = [];

        if (this._clusters != null && this._clusters !== undefined) {
            for (const cluster of this._clusters) {
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
        must_params.push(this.getMatchStringFromCase(this._case));
        if (this.additional_filters !== undefined) {
            must_params.push(...this.additional_filters);
        }
        if (this.graph_filter !== undefined) {
            must_params.push(this.graph_filter);
        }


        // if must clusters are empty, don't display anything
        if (must_clusters.length == 0) {
            must_not_clusters.push('{"match_all": {}}');
        }

        console.log('additional_filter:' + this._additional_filters[0]);

        let query = '{'; // start of all query string
        query += '"from": ' + (size * page_index);
        query += ','; // separator between from and size
        query += '"size": ' + size;
        query += ','; // separator between size and query

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

        query += ','; // separator between query and sort
        query += '"sort": ['; // begin of sort field
        query += '{'; // begin of sort parametr

        switch (sort) {
            case 'timestamp': {
                query += '"@timestamp": ';
                break;
            }
            case 'name': {
                query += '"File Name.keyword": ';
                break;
            }
            case 'size': {
                query += '"Size.keyword": ';
                break;
            }
            case 'type': {
                query += '"Type.keyword": ';
                break;
            }
            default: {
                query += '"@timestamp": ';
                break;
            }
        }
        query += '{'; // begin of sort order
        query += '"order": "' + sort_order + '"'; // Adding sorting order
        query += '}'; // end of sorting order
        query += '}'; // end of sort parametr
        query += ']'; // end of sort field
        query += '}'; // end of all string

        return query;


        /*let bodyString = '{' +
            '"from": ' + (size * page_index) + ',' +
            '"size": ' + size + ',';
        bodyString += '"query": {' +
            '"bool": {' +
            '"must": [';
        if (this._additional_filters != null && this._additional_filters !== undefined) {
            for (let index = 0; index < this._additional_filters.length; index++ ) {
                bodyString = bodyString + '{';
                bodyString = bodyString + this._additional_filters[index];
                bodyString = bodyString + '},';
            }
        }
        bodyString = bodyString + '{"bool": {' +
            '"should": [';
        if (must_tags != null && must_tags !== undefined) {
            bodyString = bodyString + '{"bool": {' +
                '"must": [' +
                '{"match": {' +
                '"case.keyword": "' + this._case + '"' +
                '}}';
            if (must_tags.length > 0) {
                bodyString = bodyString + ',';
            }

            for (let index = 0; index < must_tags.length; index++) {
                bodyString = bodyString + '{"match": {' +
                    '"tags.keyword": "' + must_tags[index] + '"' +
                    '}}';

                if (this._graph_filter != null && this._graph_filter !== undefined) {
                    bodyString = bodyString + this._graph_filter;
                }

                if (index < (must_tags.length - 1)) {
                    bodyString = bodyString + ',';
                }
            }


            bodyString = bodyString + ',{"bool": {' +
                '"must_not": [{';

            for (let index = 0; index < must_not_tags.length; index++) {
                bodyString = bodyString + '"match": {' +
                    '"tags.keyword": "' + must_not_tags[index] + '"'
                    + '}}';
                if (index < (must_not_tags.length - 1)) {
                    bodyString = bodyString + ',';
                }


            }

            bodyString = bodyString + '}';

            bodyString = bodyString + '] } }';






        }
        if (must_filters != null && must_filters !== undefined) {
            for (let index = 0; index < must_filters.length; index++) {
                if (must_tags != null && must_tags !== undefined) {
                    if (must_tags.length > 0) {
                        bodyString = bodyString + ',';
                    }
                }
                bodyString = bodyString + '{"bool": {' +
                    '"must": [' +
                    '{"match": {' +
                    '"case.keyword": "' + this._case + '"' +
                    '}}';
                bodyString = bodyString + ',' + must_filters[index];
                if (this._graph_filter != null && this._graph_filter !== undefined) {
                    bodyString = bodyString + this._graph_filter;
                }
                bodyString = bodyString + '] } }';
                if (index < (must_filters.length - 1)) {
                    bodyString += ',';
                }
            }
        } else {
            if (must_tags.length > 0) {
                bodyString = bodyString + ',';
            }
            bodyString = bodyString + '{"bool": {' +
                '"must_not": [' +
                '{"match_all": {}}';
            if (this._graph_filter != null && this._graph_filter !== undefined) {
                bodyString = bodyString + this._graph_filter;
            }
            bodyString = bodyString + '] }}';
        }

        /!* fix to not display anything when nothing is selected, TODO in FUTURE:refactor with above else,check if filters is empty *!/
        if (must_tags.length > 0) {
            bodyString = bodyString + ',';
        }

        bodyString = bodyString + '{"bool": {' +
            '"must_not": [' +
            '{"match_all": {}}';

        bodyString = bodyString + '] }}';
        /!* end of fix *!/

        bodyString = bodyString + '] } }] } }';
        bodyString = bodyString +
            '],' +
            '"sort": [' +
            '{';
        switch (sort) {
            case 'timestamp': {
                bodyString = bodyString + '"@timestamp"';
                break;
            }
            case 'name': {
                bodyString = bodyString + '"File Name.keyword"';
                break;
            }
            case 'size': {
                bodyString = bodyString + '"Size.keyword"';
                break;
            }
            case 'type': {
                bodyString = bodyString + '"Type.keyword"';
                break;
            }
            default: {
                bodyString = bodyString + '"@timestamp"';
                break;
            }
        }
        bodyString = bodyString +
            ': {' +
            '"order": "' + sort_order + '"' +
            '}' +
            '}' +
            ']';
        bodyString += '}';

        bodyString += '}}';
        return bodyString;*/
    }

    getComputationFilterString(computation: ComputationModel) {
        const appliedFilters = [];
        let filter: FilterModel;
        for (filter of Array.from(computation.filters)) {
            if (filter.isSelected) {
                appliedFilters.push(this.applyFilter(filter.json, filter.params));
            }
        }
        return this.getFilterCombination(appliedFilters);
    }

    applyFilter(filter: string, params: FilterParamModel[]) {
        let result = filter;
        for (const param of params) {
            result = result.replace('${{' + param.name + '}}$', param.value);
        }
        return result;
    }

    getFilterCombination(filters: string[]) {
        let result = filters[0];
        for (let i = 1; i < filters.length; i++) {
            result = result + ', ' + filters[i];
        }
        return result;
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

    storeCluster(index, type, cluster: ClusterModel) {
        if (!cluster.tagged) {
            const filter = this.getComputationFilterString(cluster.computation);
            this.es.addTag(
                index,
                type,
                this._case,
                filter,
                cluster.name
            ).then(response => {
                if (response.failures.length < 1) {
                    console.log(cluster.name, ' tagged');
                } else {
                    console.log('failures: ', response.failures);
                }
            }, error => {
                console.error(error);
            });
        }
    }

    removeStoredCluster(index, type, cluster: ClusterModel) {
        if (cluster.tagged) {
            this.es.removeTag(
                index,
                type,
                this._case,
                cluster.tag,
                null,
                cluster.name
            ).then(response => {
                if (response.failures.length < 1) {
                    console.log(cluster.name, ' tagged');
                } else {
                    console.log('failures: ', response.failures);
                }
            }, error => {
                console.error(error);
            });
        }
    }
}
