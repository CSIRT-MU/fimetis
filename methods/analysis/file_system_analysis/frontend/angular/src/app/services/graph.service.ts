import { Injectable } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {environment} from '../../environments/environment';
import {ClusterModel} from '../models/cluster.model';

@Injectable({ providedIn: 'root' })
export class GraphService {
    constructor(private http: HttpClient) { }

    getData(_case: string,
            _clusters: ClusterModel[],
            _additional_filters: string[],
            mac_type: string,
            frequency: string) {
        return this.http.post<any>(environment.backendUrl + '/graph/data/' + _case, {
            'clusters': _clusters,
            'additional_filters': _additional_filters,
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
            _additional_filters: string[],
            mac_type: string) {
        return this.http.post<any>(environment.backendUrl + '/cluster/first_and_last/' + _case, {
            'clusters': _clusters,
            'additional_filters': _additional_filters,
            'mac_type': mac_type
        }).toPromise().then(
            response => {
                const timestamps = [];
                timestamps.push(response[0]._source['@timestamp']);
                timestamps.push(response[1]._source['@timestamp']);
                return timestamps;
            }, error => {
                console.error(error);
                return error;
            }
        );
    }
}