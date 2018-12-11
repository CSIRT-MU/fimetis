import {ElasticsearchService} from '../elasticsearch.service';
import {ElasticsearchBaseQueryDao} from './elasticsearchBaseQueryDao';
import {DataModel} from '../models/data.model';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';

export class ClusterDao {
    private elasticsearchBaseQueryDao;

    constructor(private es: ElasticsearchService) {
        this.elasticsearchBaseQueryDao = new ElasticsearchBaseQueryDao();
    }


    getData(case_name, clusters, additional_filters, graph_filter, from, size, sort, sort_order): Promise<DataModel> {
        return new Promise((resolve, reject) => {
            this.es.runQuery(this.buildQuery(
                case_name,
                clusters,
                additional_filters,
                graph_filter,
                from,
                size,
                sort,
                sort_order)
            ).then(
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

    getNumberOfEntries(case_name, clusters, time_border): Promise<DataModel> {
        let time_filter = '';
        // time_filter += '{';     // start of time_filter
        // time_filter += '"query": {'; // start of query

        time_filter += '{';
        time_filter += '"range": {'; // start of range
        time_filter += '"@timestamp": {';   // start of timestamp definition
        time_filter += '"lt": "' + time_border + '"';
        time_filter += '}';     // end of timestamp definition
        time_filter += '}';     // end of range
        time_filter += '}';

        // time_filter += '}';     // end of query
        // time_filter += '}';     // end of time_filter

        const from = 0;
        const size = 1;
        const sort = 'timestamp';
        const sort_order = 'asc';
        const graph_filter = null;

        return new Promise((resolve, reject) => {
            this.es.runQuery(this.buildQuery(
                case_name,
                clusters,
                [time_filter],
                graph_filter,
                from,
                size,
                sort,
                sort_order)
            ).then(
                response => {
                    const count = response.hits.total;
                    resolve(count);
                    console.log(count);
                }, error => {
                    console.error(error);
                    reject();
                }
            );
        });
    }


    getStoredClusters(case_name): Promise<any> {
        return new Promise((resolve, reject) => {
            this.es.getTags(case_name).then(
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


    buildQuery(case_name, clusters, additional_filters, graph_filter, from, size, sort, sort_order) {
        let query = '{'; // start of all query string
        query += '"from": ' + from;
        query += ','; // separator between from and size
        query += '"size": ' + size;
        query += ','; // separator between size and query

        query += this.elasticsearchBaseQueryDao.getBaseQueryString(
            case_name,
            clusters,
            additional_filters,
            graph_filter);

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


    storeCluster(cluster: ClusterModel, case_name) {
        if (!cluster.tagged) {
            const filter = this.elasticsearchBaseQueryDao.getComputationFilterString(cluster.computation);
            this.es.addTag(
                case_name,
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


    removeStoredCluster(cluster: ClusterModel, case_name) {
        if (cluster.tagged) {
            this.es.removeTag(
                case_name,
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
