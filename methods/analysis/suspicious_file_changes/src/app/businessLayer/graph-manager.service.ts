import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import 'rxjs/add/operator/toPromise';


@Injectable()
export class GraphManager {

    private _index;
    private _type;
    private _case;
    private _filter;
    private _clusters;
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

    get filter() {
        return this._filter;
    }

    set filter(value) {
        this._filter = value;
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
        console.log('filter: ' + this._filter);
        console.log('clusters ' + this._clusters);
        let frequency;
        frequency = await this.getFrequency();

        const promise = new Promise((resolve, reject) => {
            this.es.getFilteredGraphData(this._index, this._type, this._case, mactime_type, this._filter, this._clusters, this._frequency)
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
        let first;
        let last;
        const one_day = 1000 * 60 * 60 * 24;

        first = await this.getFirstOrLast('asc');
        last = await this.getFirstOrLast('desc');
        console.log('first ' + first);
        console.log('last ' +  last);

        let graphFrequency = 'day';
        if (first !== 0 && last !== 0) {
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

        this.frequency = graphFrequency;
    }


    // asc for first entry, desc for last entry
    getFirstOrLast(ascOrDesc): Promise<any>  {
        let entry;

        const promise = new Promise((resolve, reject) => {
            this.es.getFilteredPage(
                this._index,
                this._type,
                this._case,
                1,
                0,
                this._filter,
                this._clusters,
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
}
