import { Injectable } from '@angular/core';
import {ClusterModel} from '../models/cluster.model';
import {DataModel} from '../models/data.model';
import { HTTPService } from './http.service';

@Injectable({ providedIn: 'root' })
export class ClusterService {
    constructor(private http: HTTPService) { }

    getData(_case: string,
            _clusters: ClusterModel[],
            marks_ids: string[],
            _additional_filters: object,
            begin: number,
            page_size: number,
            sort: string,
            sort_order: string) {
        return this.http.post('/clusters/data/' + _case, {
            'clusters': _clusters,
            'marks_ids': marks_ids,
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

    getRankOfMarkedMactimeById(_case: string,
                  _clusters: ClusterModel[],
                  marks_ids: string[],
                  _additional_filters: object,
                  size: number,
                  sort: string,
                  sort_order: string,
                  mark_id: string
                  ) {
        return this.http.post('/clusters/get_rank_of_marked_mactime_by_id/' + _case, {
            'clusters': _clusters,
            'marks_ids': marks_ids,
            'additional_filters': JSON.stringify(_additional_filters),
            'size': size,
            'sort': sort,
            'sort_order': sort_order,
            'mark_id': mark_id
        }).toPromise().then(
            response => {
                return response.rank;
            }
        );
    }

    getRankOfMactimeByTimestamp(_case: string,
                  _clusters: ClusterModel[],
                  marks_ids: string[],
                  _additional_filters: object,
                  size: number,
                  sort: string,
                  sort_order: string,
                  date: Date
    ) {
        return this.http.post('/clusters/get_rank_of_mactime_by_timestamp/' + _case, {
            'clusters': _clusters,
            'marks_ids': marks_ids,
            'additional_filters': JSON.stringify(_additional_filters),
            'size': size,
            'sort': sort,
            'sort_order': sort_order,
            'timestamp': date
        }).toPromise().then(
            response => {
                return response.rank;
            }
        );
    }

    countAllDataTotal(_case: string,
              _clusters: ClusterModel[],
              _additional_filters: object) {
        return this.http.post('/clusters/data_counts/' + _case, {
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
        return this.http.post('/cluster/count/' + _case, {
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
        return this.http.post('/clusters/entries_border/' + _case, {
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

    loadClustersFromDatabase() {
        return this.http.get('/cluster-definition/all').toPromise().then(
            response => {
                return response;
            }, error => {
                console.error(error);
                return error;
            });
    }

    loadClustersForUserAndCase(case_name) {
        return this.http.get('/cluster-definition/case/' + case_name).toPromise().then(
            response => {
                return response;
            }, error => {
                console.error(error);
                return error;
            });
    }

    addClusterDefinition(name, definition, description, filter_name) {
        return this.http.post('/cluster-definition/add',
            {'name': name, 'definition': definition, 'description': description, 'filter_name': filter_name}).toPromise();

    }

    deleteClusterDefinition(id) {
        return this.http.get('/cluster-definition/delete/' + id).toPromise();
    }

    addUserClustersForCase(case_name, cluster_ids) {
        return this.http.post('/cluster-definition/case/' + case_name + '/add-user-clusters',
            {'cluster_ids' : cluster_ids}).toPromise();
    }

    deleteUserClustersForCase(case_name, cluster_ids) {
        return this.http.post('/cluster-definition/case/' + case_name + '/delete-user-clusters',
            {'cluster_ids' : cluster_ids}).toPromise();
    }

}
