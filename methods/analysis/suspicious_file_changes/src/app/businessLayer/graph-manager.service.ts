import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import 'rxjs/add/operator/toPromise';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ComputationModel} from '../models/computation.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {query} from '@angular/animations';


@Injectable()
export class GraphManager {

    private _index;
    private _type;
    private _case;
    private _clusters: ClusterModel[] = [];
    private _frequency;
    private _additionalFilters;

    constructor(private es: ElasticsearchService) {
    }


    get index() {
        return this._index;
    }

    set index(value) {
        this._index = value;
    }

    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
    }

    get case() {
        return this._case;
    }

    set case(value) {
        this._case = value;
    }

    get clusters() {
        return this._clusters;
    }

    set clusters(value) {
        this._clusters = value;
    }

    get frequency() {
        return this._frequency;
    }

    set frequency(value) {
        this._frequency = value;
    }


    get additionalFilters() {
        return this._additionalFilters;
    }

    set additionalFilters(value) {
        this._additionalFilters = value;
    }


    async getData(mactime_type): Promise<any> {
        console.log('clusters ' + this._clusters);
        let frequency;
        frequency = await this.getFrequency();
        const queryString = this.buildQuery(mactime_type);
        const promise = new Promise((resolve, reject) => {
            this.es.runQuery(this._index, this._type, queryString)
                .then(response => {
                        const data = response.aggregations.dates.buckets;
                        const x = data.map(d => d['key_as_string']);
                        const y = data.map(d => d['doc_count']);
                        resolve({x: x, y: y});
                    }, error => {
                        console.error(error);
                        console.log('loading mactimes async failed');
                        reject();
                    }
                );
        } );
        return promise;
    }


    async getFrequency() {
        let first = 0;
        let last = 0;
        const one_day = 1000 * 60 * 60 * 24;

        // TODO: fix getFirstOrLast method

        // first = await this.getFirstOrLast('asc');
        // last = await this.getFirstOrLast('desc');
        console.log('first ' + first);
        console.log('last ' +  last);

        let graphFrequency = 'day';
        if (first !== 0 && last !== 0 && first !== undefined && last !== undefined) {
            const diff = (new Date(last).getTime() - new Date(first).getTime()) / one_day;
            if (diff > 365) {
                graphFrequency = 'day';
            }
            if (diff <= 365 && diff > 60) {
                graphFrequency = 'hour';
            }
            if (diff <= 60 && diff > 30) {
                graphFrequency = 'minute';
            }
            if (diff <= 30) {
                graphFrequency = 'minute';
            }
        } else {
            graphFrequency = 'day';
        }
        console.log('frequency', graphFrequency);
        this.frequency = graphFrequency;
    }


    // TODO: fix getFirstOrLast method
    // asc for first entry, desc for last entry
    getFirstOrLast(ascOrDesc): Promise<any>  {
        console.log('run first or last');
        let entry;
        const tags = [];
        let filter = '{"bool": {' +
            '"should": [ ';
        for (const clust of this._clusters) {
            if (clust.selectMode === ClusterSelectMode.added){
                if (clust.tagged) {
                    tags.push(clust.tag);
                } else {
                    filter += this.getComputationFilterString(clust.computation);
                    filter += ',';
                }
            }
        }
        filter = filter.slice(0, -1);
        filter += ']}}';

        const promise = new Promise((resolve, reject) => {
            this.es.getFilteredPage(
                this._index,
                this._type,
                this._case,
                1,
                0,
                filter,
                tags,
                'timestamp',
                ascOrDesc,
                this._additionalFilters
            ).then(
                response => {
                    if (response.hits.total !== 0) {
                        entry = response.hits.hits[0]._source['@timestamp'];
                        console.log('Getting first single entry by ' + ascOrDesc + ' ' + entry);
                        resolve(entry);
                    } else {
                        entry = 0;
                    }
                }
        );
    });
    return promise;

    }

    buildQuery(mactime_type) {
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
        const graphFilter = ', ' +
            '{"match": { ' +
            '"Type": "' + mactime_type + '"' +
            '}}';
        let bodyString = '{' ;
        bodyString += '"query": {' +
            '"bool": {' +
            '"must": [';
        if (this.additionalFilters != null && this.additionalFilters !== undefined) {
            for (let index = 0; index < this.additionalFilters.length; index++ ) {
                bodyString = bodyString + '{';
                bodyString = bodyString + this.additionalFilters[index];
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
                if (mactime_type != null && mactime_type !== undefined) {
                    bodyString = bodyString + graphFilter;
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
                if (mactime_type != null && mactime_type !== undefined) {
                    bodyString = bodyString + graphFilter;
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
            if (mactime_type != null && mactime_type !== undefined) {
                bodyString = bodyString + graphFilter;
            }
            bodyString = bodyString + '] }}';
        }
        bodyString = bodyString + '] } }] } }';

        bodyString = bodyString + ',' +
            '"aggs": {' +
            '"dates": {' +
            '"date_histogram": {' +
            '"field": "@timestamp",' +
            '"interval": "' + this.frequency + '"' +
            '}' +
            '}' +
            '}';
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
