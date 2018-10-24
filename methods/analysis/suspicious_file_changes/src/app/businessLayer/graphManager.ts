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
        console.log('clusters ', this._clusters);
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
                        console.log('Getting first single entry by ' + ascOrDesc + ' ' + entry);
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
        let query = '{'; // start of all query string
        query += '"from": 0';
        query += ',';
        query += '"size": 1';
        query += ',';

        query += this.elasticsearchBaseQueryManager.getBaseQueryString(
            this.case,
            this.clusters,
            this.additionalFilters,
            this.elasticsearchBaseQueryManager.getGraphFilterFromMactimeType(mactime_type));

        query += ','; // separator between query and sort
        query += '"sort": ['; // begin of sort field
        query += '{'; // begin of sort parametr

        query += '"@timestamp": ';

        query += '{'; // begin of sort order
        query += '"order": "' + first_or_last + '"'; // Adding sorting order
        query += '}'; // end of sorting order
        query += '}'; // end of sort parametr
        query += ']'; // end of sort field
        query += '}'; // end of all string

        return query;


    }

    buildQuery(mactime_type) {
        let query = '{'; // start of all query string

        console.log('test', this.elasticsearchBaseQueryManager.getGraphFilterFromMactimeType(mactime_type));
        // get the base query string
        query += this.elasticsearchBaseQueryManager.getBaseQueryString(
            this.case,
            this.clusters,
            this.additionalFilters,
            this.elasticsearchBaseQueryManager.getGraphFilterFromMactimeType(mactime_type));

        query += ','; // separator between query and aggs
        query += '"aggs": {'; // start of aggregation
        query += '"dates": {'; // start of dates
        query += '"date_histogram": {'; // start of date histogram
        query += '"field": "@timestamp"';
        query += ','; // separator between field and interval
        query += '"interval": "' + this._frequency + '"';

        query += '}'; // end of histogram
        query += '}'; // end of dates
        query += '}'; // end of aggregations



        query += '}'; // end of all string

        console.log(query);

        return query;
    }
}
