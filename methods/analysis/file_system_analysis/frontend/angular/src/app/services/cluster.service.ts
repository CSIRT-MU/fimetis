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
            _additional_filters: string[],
            graph_filter: string,
            begin: number,
            page_size: number,
            sort: string,
            sort_order: string) {
        return this.http.post<any>(environment.backendUrl + '/clusters/data/' + _case, {
            'clusters': _clusters,
            'additional_filters': _additional_filters,
            'graph_filter': graph_filter,
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
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    countData(_case: string,
            _cluster: ClusterModel,
            _additional_filters: string[]) {
        return this.http.post<any>(environment.backendUrl + '/cluster/count/' + _case, {
            'cluster': _cluster,
            'additional_filters': _additional_filters
        }).toPromise().then(
            response => {
                return response.hits.total;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    numberOfEntries(_case: string,
                    _clusters: ClusterModel[],
                    _additional_filters: string[],
                    timeBorder: string) {
        return this.http.post<any>(environment.backendUrl + '/clusters/entries_border/' + _case, {
            'clusters': _clusters,
            'additional_filters': _additional_filters,
            'border': timeBorder
        }).toPromise().then(
            response => {
                console.log('response', response);
                return response.hits.total;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }
}
