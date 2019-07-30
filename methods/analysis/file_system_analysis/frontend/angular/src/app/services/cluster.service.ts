import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {ClusterModel} from '../models/cluster.model';
import {DataModel} from '../models/data.model';

@Injectable({ providedIn: 'root' })
export class ClusterService {
    constructor(private http: HttpClient) { }

    getData(_case: string,
            _clusters: ClusterModel[],
            _additional_filters: object,
            begin: number,
            page_size: number,
            sort: string,
            sort_order: string) {
        return this.http.post<any>(environment.backendUrl + '/clusters/data/' + _case, {
            'clusters': _clusters,
            'additional_filters': JSON.stringify(_additional_filters),
            // 'begin': my_begin,
            'begin': begin,
            'page_size': page_size,
            'sort': sort,
            'sort_order': sort_order
        }).toPromise().then(
            response => {
                const data = new DataModel();
                data.data = response.hits.hits;
                data.total = response.hits.total;
                return data;
            }
        );
    }

    countAllDataTotal(_case: string,
              _clusters: ClusterModel[],
              _additional_filters: object) {
        return this.http.post<any>(environment.backendUrl + '/clusters/data_counts/' + _case, {
            'clusters': _clusters,
            'additional_filters': JSON.stringify(_additional_filters)
        }).toPromise().then(
            response => {
                return response;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    countData(_case: string,
            _cluster: ClusterModel,
            _additional_filters: object) {
        return this.http.post<any>(environment.backendUrl + '/cluster/count/' + _case, {
            'cluster': _cluster,
            'additional_filters': JSON.stringify(_additional_filters)
        }).toPromise().then(
            response => {
                return {'total': response.total, 'totalAll': response.total_all};
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    countEntriesOfClusters(_case, _clusters, _additionalFilters) {
        for (const clust of _clusters) {
            this.countData(_case, clust, _additionalFilters).then(res => {
                clust.count = res.total;
                clust.totalCount = res.totalAll;
            }, error => {
                console.error(error);
            });
        }
    }

    numberOfEntries(_case: string,
                    _clusters: ClusterModel[],
                    _additional_filters: object,
                    timeBorder: string) {
        _additional_filters['timeBorder'] = timeBorder;
        return this.http.post<any>(environment.backendUrl + '/clusters/entries_border/' + _case, {
            'clusters': _clusters,
            'additional_filters': JSON.stringify(_additional_filters)
        }).toPromise().then(
            response => {
                return response.hits.total;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    async getDifferenceShift(_case, newClusters, oldClusters, firstVisibleIndex, firstEntry) {
        if (oldClusters == null || oldClusters === undefined || firstEntry === undefined) {
            return 0;
        }
        if (oldClusters.length === 0) {
            return 0;
        }
        const old_number = await this.numberOfEntries(_case, oldClusters, {}, firstEntry._source['@timestamp']);
        const new_number = await this.numberOfEntries(_case, newClusters, {}, firstEntry._source['@timestamp']);
        return new_number - old_number;
    }
}
