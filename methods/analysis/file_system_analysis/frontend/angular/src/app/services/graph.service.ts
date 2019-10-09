import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {ClusterModel} from '../models/cluster.model';

@Injectable({ providedIn: 'root' })
export class GraphService {
    constructor(private http: HttpClient) { }

    getData(_case: string,
            _clusters: ClusterModel[],
            _additional_filters: object,
            mac_type: string,
            frequency: string) {
        return this.http.post<any>(environment.backendUrl + '/graph/data/' + _case, {
            'clusters': _clusters,
            'additional_filters': JSON.stringify(_additional_filters),
            'mac_type': mac_type,
            'frequency': frequency
        }).toPromise().then(
            response => {
                const data = response.aggregations.dates.buckets;
                const x = data.map(d => d['key_as_string']);
                const y = data.map(d => d['doc_count']);
                return({x: x, y: y});
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    getFirstAndLastTimestamp(_case: string,
            _clusters: ClusterModel[],
            _additional_filters: object,
            mac_type: string) {
        return this.http.post<any>(environment.backendUrl + '/graph/first_and_last/' + _case, {
        }).toPromise().then(
            response => {
                const timestamps = [];
                if (response.length > 0) {
                    timestamps.push(response[0]._source['@timestamp']);
                    timestamps.push(response[1]._source['@timestamp']);
                }
                return timestamps;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }

    async computeMaxFrequency(_case: string, _clusters: ClusterModel[], _additional_filters: object) {
        let first = 0;
        let last = 0;
        const one_day = 1000 * 60 * 60 * 24;
        const firstAndLast = await this.getFirstAndLastTimestamp(_case, _clusters, _additional_filters, null);
        first = firstAndLast[0];
        last = firstAndLast[1];
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

    async isMarkInCurrentCluster(_case: string, _clusters: ClusterModel[], id: string) {
        return this.http.post<any>(environment.backendUrl + '/graph/is_mark_in_cluster/' + _case, {
            'clusters': _clusters,
            'id': id
        }).toPromise().then(
            response => {
               return response.hits.hits.length === 1;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }
}
