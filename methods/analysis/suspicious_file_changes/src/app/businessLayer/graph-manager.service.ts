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

        first = await this.getFirstOrLast('asc');
        last = await this.getFirstOrLast('desc');
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


    // asc for first entry, desc for last entry
    getFirstOrLast(ascOrDesc): Promise<any>  {
        console.log('run first or last');
        let entry;
        const tags = [];
        let filter = ',{"bool": {' +
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
        if (this.additionalFilters !== undefined) {
            must_params.push(...this.additionalFilters);
        }


        if (this.getGraphFilterFromMactimeType(mactime_type) !== undefined) {
            must_params.push(this.getGraphFilterFromMactimeType(mactime_type));
        }


        // if must clusters are empty, don't display anything
        if (must_clusters.length == 0) {
            must_not_clusters.push('{"match_all": {}}');
        }

        // console.log('additional_filter:' + this._additionalFilters[0]);

        let query = '{'; // start of all query string
        // query += '"from": ' + (size * page_index);
        // query += ','; // separator between from and size
        // query += '"size": ' + size;
        // query += ','; // separator between size and query

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

        query += ','; // separator between query and aggs
        query += '"aggs": {'; // start of aggregation
        query += '"dates": {'; // start of dates
        query += '"date_histogram": {'; // start of date histogram
        query += '"field": "@timestamp"';
        query += ','; // separator between field and interval
        query += '"interval": "' + 'day' + '"';

        query += '}'; // end of histogram
        query += '}'; // end of dates
        query += '}'; // end of aggregations



        query += '}'; // end of all string

        console.log(query);

        return query;
        // console.log('clust', this._clusters);
        // const _tags: string[] = [];
        // const _filters: string[] = [];
        // if (this._clusters != null && this._clusters !== undefined) {
        //     for (const cluster of this._clusters) {
        //         if (cluster.selectMode !== ClusterSelectMode.notSelected) {
        //             if (cluster.selectMode === ClusterSelectMode.added) {
        //                 if (cluster.tagged) {
        //                     _tags.push(cluster.tag);
        //
        //                 } else {
        //                     if (cluster.computation.isSelected) {
        //                         const filter = this.getComputationFilterString(cluster.computation);
        //                         if (filter != null && filter !== undefined) {
        //                             _filters.push(filter);
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        // const graphFilter = ', ' +
        //     '{"match": { ' +
        //     '"Type": "' + mactime_type + '"' +
        //     '}}';
        // let bodyString = '{' ;
        // bodyString += '"query": {' +
        //     '"bool": {' +
        //     '"must": [';
        // if (this.additionalFilters != null && this.additionalFilters !== undefined) {
        //     for (let index = 0; index < this.additionalFilters.length; index++ ) {
        //         bodyString = bodyString + '{';
        //         bodyString = bodyString + this.additionalFilters[index];
        //         bodyString = bodyString + '},';
        //     }
        // }
        // bodyString = bodyString + '{"bool": {' +
        //     '"should": [';
        // if (_tags != null && _tags !== undefined) {
        //     for (let index = 0; index < _tags.length; index++) {
        //         bodyString = bodyString + '{"bool": {' +
        //             '"must": [' +
        //             '{"match": {' +
        //             '"case.keyword": "' + this._case + '"' +
        //             '}},' +
        //             '{"match": {' +
        //             '"tags.keyword": "' + _tags[index] + '"' +
        //             '}}';
        //         if (mactime_type != null && mactime_type !== undefined) {
        //             bodyString = bodyString + graphFilter;
        //         }
        //         bodyString = bodyString + '] } }';
        //         if (index < (_tags.length - 1)) {
        //             bodyString = bodyString + ',';
        //         }
        //     }
        // }
        // if (_filters != null && _filters !== undefined) {
        //     for (let index = 0; index < _filters.length; index++) {
        //         if (_tags != null && _tags !== undefined) {
        //             if (_tags.length > 0) {
        //                 bodyString = bodyString + ',';
        //             }
        //         }
        //         bodyString = bodyString + '{"bool": {' +
        //             '"must": [' +
        //             '{"match": {' +
        //             '"case.keyword": "' + this._case + '"' +
        //             '}}';
        //         bodyString = bodyString + ',' + _filters[index];
        //         if (mactime_type != null && mactime_type !== undefined) {
        //             bodyString = bodyString + graphFilter;
        //         }
        //         bodyString = bodyString + '] } }';
        //         if (index < (_filters.length - 1)) {
        //             bodyString += ',';
        //         }
        //     }
        // } else {
        //     if (_tags.length > 0) {
        //         bodyString = bodyString + ',';
        //     }
        //     bodyString = bodyString + '{"bool": {' +
        //         '"must_not": [' +
        //         '{"match_all": {}}';
        //     if (mactime_type != null && mactime_type !== undefined) {
        //         bodyString = bodyString + graphFilter;
        //     }
        //     bodyString = bodyString + '] }}';
        // }
        //
        // /* fix to not display anything when nothing is selected, TODO in FUTURE:refactor with above else,check if filters is empty */
        // if (_tags.length > 0  || _filters.length > 0) {
        //     bodyString = bodyString + ',';
        // }
        //
        // bodyString = bodyString + '{"bool": {' +
        //     '"must_not": [' +
        //     '{"match_all": {}}';
        //
        // bodyString = bodyString + '] }}';
        // /* end of fix */
        //
        // bodyString = bodyString + '] } }] } }';
        //
        // bodyString = bodyString + ',' +
        //     '"aggs": {' +
        //     '"dates": {' +
        //     '"date_histogram": {' +
        //     '"field": "@timestamp",' +
        //     '"interval": "' + this.frequency + '"' +
        //     '}' +
        //     '}' +
        //     '}';
        // bodyString += '}';
        // return bodyString;

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

    getGraphFilterFromMactimeType(mactime_type: string) {
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
}
