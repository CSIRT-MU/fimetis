import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import 'rxjs/add/operator/toPromise';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ComputationModel} from '../models/computation.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {query} from '@angular/animations';
import {ElasticsearchBaseQueryManager} from './elasticsearchBaseQueryManager';


@Injectable()
export class GraphManager {

    private _index;
    private _type;
    private _case;
    private _clusters: ClusterModel[] = [];
    private _frequency;
    private _additionalFilters;

    private elasticsearchBaseQueryManager;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();

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
        await this.getFrequency();
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
        this._frequency = graphFrequency;
    }


    // asc for first entry, desc for last entry
    getFirstOrLast(ascOrDesc): Promise<any>  {

        const promise = new Promise((resolve, reject) => {
            let entry;
            this.es.runQuery(this._index, this._type, this.buildFirstOrLastQuery(ascOrDesc, null))
            .then(
                response => {
                    if (response.hits.total !== 0) {
                        entry = response.hits.hits[0]._source['@timestamp'];
                    } else {
                        entry = 0;
                    }
                    resolve(entry);
                }
            );
        });
        return promise;

    }


    buildFirstOrLastQuery(first_or_last, mactime_type) {
        let first_or_lastquery = '{'; // start of all query string
        first_or_lastquery += '"from": 0';
        first_or_lastquery += ',';
        first_or_lastquery += '"size": 1';
        first_or_lastquery += ',';

        first_or_lastquery += this.elasticsearchBaseQueryManager.getBaseQueryString(
            this.case,
            this.clusters,
            this.additionalFilters,
            this.elasticsearchBaseQueryManager.getGraphFilterFromMactimeType(mactime_type));

        first_or_lastquery += ','; // separator between query and sort
        first_or_lastquery += '"sort": ['; // begin of sort field
        first_or_lastquery += '{'; // begin of sort parametr

        first_or_lastquery += '"@timestamp": ';

        first_or_lastquery += '{'; // begin of sort order
        first_or_lastquery += '"order": "' + first_or_last + '"'; // Adding sorting order
        first_or_lastquery += '}'; // end of sorting order
        first_or_lastquery += '}'; // end of sort parametr
        first_or_lastquery += ']'; // end of sort field
        first_or_lastquery += '}'; // end of all string

        return first_or_lastquery;


    }

    buildQuery(mactime_type) {
        let builded_query = '{'; // start of all query string

        // get the base query string
        builded_query += this.elasticsearchBaseQueryManager.getBaseQueryString(
            this.case,
            this.clusters,
            this.additionalFilters,
            this.elasticsearchBaseQueryManager.getGraphFilterFromMactimeType(mactime_type));

        builded_query += ','; // separator between query and aggs
        builded_query += '"aggs": {'; // start of aggregation
        builded_query += '"dates": {'; // start of dates
        builded_query += '"date_histogram": {'; // start of date histogram
        builded_query += '"field": "@timestamp"';
        builded_query += ','; // separator between field and interval
        builded_query += '"interval": "' + this._frequency + '"';

        builded_query += '}'; // end of histogram
        builded_query += '}'; // end of dates
        builded_query += '}'; // end of aggregations

        builded_query += '}'; // end of all string

        return builded_query;
    }
}
