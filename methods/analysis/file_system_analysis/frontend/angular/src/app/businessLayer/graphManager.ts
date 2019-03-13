import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import 'rxjs/add/operator/toPromise';
import {ClusterModel} from '../models/cluster.model';
import {GraphDao} from '../dao/graphDao';
import {BaseDao} from '../dao/baseDao';
import {GraphService} from '../services/graph.service';


@Injectable()
export class GraphManager {

    private _case;
    private _clusters: ClusterModel[] = [];
    private _frequency;
    private _additionalFilters;

    private graphDao;
    private baseDao;

    constructor(private es: ElasticsearchService, private service: GraphService) {
        this.graphDao = new GraphDao(es);
        this.baseDao = new BaseDao(es);
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

    async getData(mactime_type) {
        const frequency = await this.getFrequency();


        // return this.graphDao.getData(this.case, this.clusters, this.additionalFilters, mactime_type, frequency);
        return this.service.getData(this.case, this.clusters, this.additionalFilters, mactime_type, frequency);

    }

    async getFrequency() {
        let first = 0;
        let last = 0;
        const one_day = 1000 * 60 * 60 * 24;

        first = await this.baseDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'asc');
        last = await this.baseDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'desc');

        let frequency = 'day';
        if (first !== 0 && last !== 0 && first !== undefined && last !== undefined) {
            const diff = (new Date(last).getTime() - new Date(first).getTime()) / one_day;
            if (diff > 365) {
                frequency = 'day';
            }
            if (diff <= 365 && diff > 60) {
                frequency = 'hour';
            }
            if (diff <= 60 && diff > 30) {
                frequency = 'minute';
            }
            if (diff <= 30) {
                frequency = 'minute';
            }
        } else {
            frequency = 'day';
        }

        return frequency;
    }

    async getFirstAndLast() {
        return await this.service.getFirstAndLastTimestamp(this.case, this.clusters, this.additionalFilters, null);
        // const first = await this.baseDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'asc');
        // const last = await this.baseDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'desc');
        // return [first, last];
    }

}
