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
    private _sort_by: string = null;

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

    getData(index, type, page_index, page_size, sort, sort_order): Promise<DataModel> {
        return new Promise((resolve, reject) => {
            this.es.runQuery(index, type, this.buildQuery(page_index, page_size, sort, sort_order)).then(
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
        const _tags: string[] = [];
        const _filters: string[] = [];
        if (this._clusters != null && this._clusters !== undefined) {
            for (const cluster of this._clusters) {
                if (cluster.selectMode !== ClusterSelectMode.notSelected) {
                    if (cluster.selectMode === ClusterSelectMode.added) {
                        if (cluster.tagged) {
                            _tags.push(cluster.tag);

                        } else {
                            if (cluster.computation.isSelected) {
                                const filter = this.getComputationFilterString(cluster.computation);
                                if (filter != null && filter !== undefined) {
                                    _filters.push(filter);
                                }
                            }
                        }
                    }
                }
            }
        }
        let bodyString = '{' +
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
        if (_tags != null && _tags !== undefined) {
            for (let index = 0; index < _tags.length; index++) {
                bodyString = bodyString + '{"bool": {' +
                    '"must": [' +
                    '{"match": {' +
                    '"case.keyword": "' + this._case + '"' +
                    '}},' +
                    '{"match": {' +
                    '"tags.keyword": "' + _tags[index] + '"' +
                    '}}';
                if (this._graph_filter != null && this._graph_filter !== undefined) {
                    bodyString = bodyString + this._graph_filter;
                }
                bodyString = bodyString + '] } }';
                if (index < (_tags.length - 1)) {
                    bodyString = bodyString + ',';
                }
            }
        }
        if (_filters != null && _filters !== undefined) {
            for (let index = 0; index < _filters.length; index++) {
                if (_tags != null && _tags !== undefined) {
                    if (_tags.length > 0) {
                        bodyString = bodyString + ',';
                    }
                }
                bodyString = bodyString + '{"bool": {' +
                    '"must": [' +
                    '{"match": {' +
                    '"case.keyword": "' + this._case + '"' +
                    '}}';
                bodyString = bodyString + ',' + _filters[index];
                if (this._graph_filter != null && this._graph_filter !== undefined) {
                    bodyString = bodyString + this._graph_filter;
                }
                bodyString = bodyString + '] } }';
                if (index < (_filters.length - 1)) {
                    bodyString += ',';
                }
            }
        } else {
            if (_tags.length > 0) {
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
        bodyString = bodyString + '] } }] } }';
        bodyString = bodyString +
            ',' +
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
        return bodyString;
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
}
