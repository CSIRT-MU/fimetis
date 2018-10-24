import {FilterModel} from '../models/filter.model';
import {ComputationModel} from '../models/computation.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {MetadataModel} from '../models/metadata.model';
import 'rxjs/add/operator/toPromise';
import {DataModel} from '../models/data.model';
import {ElasticsearchBaseQueryManager} from './elasticsearchBaseQueryManager';


export class ClusterManager {
    private _clusters: ClusterModel[];
    private _case: string;
    private _graph_filter: string;
    private _additional_filters: string[];

    private elasticsearchBaseQueryManager;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();
    }

    get case(): string {
        return this._case;
    }

    set case(value: string) {
        this._case = value;
    }

    get graph_filter(): string {
        return this._graph_filter;
    }

    set graph_filter(value: string) {
        this._graph_filter = value;
    }

    get additional_filters(): string[] {
        return this._additional_filters;
    }

    set additional_filters(value: string[]) {
        this._additional_filters = value;
    }

    get clusters(): ClusterModel[] {
        return this._clusters;
    }

    set clusters(value: ClusterModel[]) {
        this._clusters = value;
    }

    private getBaseClusters() {
        const result = [];
        if (this._clusters != null && this._clusters !== undefined) {
            let clusters = [];
            let tmp = [];
            clusters.push(...this._clusters);
            let found_subClusters = false;
            do {
                found_subClusters = false;
                for (const cluster of clusters) {
                    if (cluster.subClusters.length > 0) {
                        for (const sub of cluster.subClusters) {
                           tmp.push(sub);
                        }
                        found_subClusters = true;
                    } else {
                        result.push(cluster);
                    }
                }
                clusters = tmp;
                tmp = [];
            } while (found_subClusters);
        }
        return result;
    }

    getData(index, type, begin, page_size, sort, sort_order): Promise<DataModel> {
        return new Promise((resolve, reject) => {
            this.es.runQuery(index, type, this.buildQuery(begin, page_size, sort, sort_order)).then(
                response => {
                    const data = new DataModel();
                    data.data = response.hits.hits;
                    data.total = response.hits.total;
                    resolve(data);
                }, error => {
                    console.error(error);
                    reject();
                }
            );
        });
    }

    getStoredClusters(index, type): Promise<any> {
        return new Promise((resolve, reject) => {
            this.es.getTags(index, type, this.case).then(
                response => {
                    const aggrCluster = new ClusterModel();
                    aggrCluster.name = 'Aggregation';
                    aggrCluster.count = 0;
                    const data: Set<ClusterModel> = new Set<ClusterModel>();
                    const tags = response.aggregations.tags.buckets;
                    for (const tag of tags) {
                        const cluster = new ClusterModel();
                        cluster.tag = tag.key;
                        cluster.name = tag.key;
                        cluster.count = tag.doc_count;
                        cluster.tagged = true;
                        cluster.selectMode = ClusterSelectMode.notSelected;
                        if (tag.key.startsWith('aggr-')) {
                            aggrCluster.subClusters.push(cluster);
                            aggrCluster.count += cluster.count;
                        } else {
                            data.add(cluster);
                        }
                    }
                    if (aggrCluster.subClusters.length > 0) {
                        data.add(aggrCluster);
                    }
                    resolve(data);
                }, error => {
                    console.error(error);
                    reject();
                }
            );
        });
    }

    buildQuery(from, size, sort, sort_order) {
        let query = '{'; // start of all query string
        query += '"from": ' + from;
        query += ','; // separator between from and size
        query += '"size": ' + size;
        query += ','; // separator between size and query

        query += this.elasticsearchBaseQueryManager.getBaseQueryString(
            this.case,
            this.clusters,
            this.additional_filters,
            this.graph_filter);

        query += ','; // separator between query and sort
        query += '"sort": ['; // begin of sort field
        query += '{'; // begin of sort parametr

        switch (sort) {
            case 'timestamp': {
                query += '"@timestamp": ';
                break;
            }
            case 'name': {
                query += '"File Name.keyword": ';
                break;
            }
            case 'size': {
                query += '"Size.keyword": ';
                break;
            }
            case 'type': {
                query += '"Type.keyword": ';
                break;
            }
            default: {
                query += '"@timestamp": ';
                break;
            }
        }
        query += '{'; // begin of sort order
        query += '"order": "' + sort_order + '"'; // Adding sorting order
        query += '}'; // end of sorting order
        query += '}'; // end of sort parametr
        query += ']'; // end of sort field
        query += '}'; // end of all string

        return query;

    }


    storeCluster(index, type, cluster: ClusterModel) {
        if (!cluster.tagged) {
            const filter = this.elasticsearchBaseQueryManager.getComputationFilterString(cluster.computation);
            this.es.addTag(
                index,
                type,
                this._case,
                filter,
                cluster.name
            ).then(response => {
                if (response.failures.length < 1) {
                    console.log(cluster.name, ' tagged');
                } else {
                    console.log('failures: ', response.failures);
                }
            }, error => {
                console.error(error);
            });
        }
    }

    removeStoredCluster(index, type, cluster: ClusterModel) {
        if (cluster.tagged) {
            this.es.removeTag(
                index,
                type,
                this._case,
                cluster.tag,
                null,
                cluster.name
            ).then(response => {
                if (response.failures.length < 1) {
                    console.log(cluster.name, ' tagged');
                } else {
                    console.log('failures: ', response.failures);
                }
            }, error => {
                console.error(error);
            });
        }
    }
}
