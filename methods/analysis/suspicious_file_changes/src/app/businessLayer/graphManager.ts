import {ElasticsearchService} from '../elasticsearch.service';
import {Injectable} from '@angular/core';
import 'rxjs/add/operator/toPromise';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ComputationModel} from '../models/computation.model';
import {FilterModel} from '../models/filter.model';
import {FilterParamModel} from '../models/filterParam.model';
import {query} from '@angular/animations';
import {ElasticsearchBaseQueryManager} from './elasticsearchBaseQueryManager';
import {GraphDao} from '../dao/graphDao';


@Injectable()
export class GraphManager {

    private _case;
    private _clusters: ClusterModel[] = [];
    private _frequency;
    private _additionalFilters;

    private graphDao;

    constructor(private es: ElasticsearchService) {
        this.graphDao = new GraphDao(es);

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


        return this.graphDao.getData(this.case, this.clusters, this.additionalFilters, mactime_type, frequency);

    }

    async getFirstOrLast(ascOrDesc) {
        return this.graphDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, ascOrDesc);
    }


    async getFrequency() {
        let first = 0;
        let last = 0;
        const one_day = 1000 * 60 * 60 * 24;

        first = await this.graphDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'asc');
        last = await this.graphDao.getFirstOrLast(this.case, this.clusters, this.additionalFilters, 'desc');

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

}
