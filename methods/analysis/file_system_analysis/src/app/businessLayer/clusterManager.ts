import {FilterModel} from '../models/filter.model';
import {ComputationModel} from '../models/computation.model';
import {FilterParamModel} from '../models/filterParam.model';
import {ClusterModel, ClusterSelectMode} from '../models/cluster.model';
import {ElasticsearchService} from '../elasticsearch.service';
import {MetadataModel} from '../models/metadata.model';
import 'rxjs/add/operator/toPromise';
import {DataModel} from '../models/data.model';
import {ElasticsearchBaseQueryManager} from './elasticsearchBaseQueryManager';
import {ClusterDao} from '../dao/clusterDao';


export class ClusterManager {
    private _clusters: ClusterModel[];
    private _case: string;
    private _graph_filter: string;
    private _additional_filters: string[];

    // private elasticsearchBaseQueryManager;
    private clusterDao;

    constructor(private es: ElasticsearchService) {
        // this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();
        this.clusterDao = new ClusterDao(es);
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

    getData(begin, page_size, sort, sort_order) {
        return this.clusterDao.getData(
            this.case, this.clusters, this.additional_filters, this.graph_filter, begin, page_size, sort, sort_order
        );
    }

    getStoredClusters(): Promise<any> {
        return this.clusterDao.getStoredClusters(this.case);
    }

    storeCluster(cluster: ClusterModel) {
        this.clusterDao.storeCluster(cluster, this.case);
    }

    removeStoredCluster(cluster: ClusterModel) {
        this.clusterDao.removeStoredCluster(cluster, this.case);

    }

    async getDifferenceShift(oldClusters, preloadVisibleStart, mactime_entry) {
        if (oldClusters == null || oldClusters === undefined || mactime_entry === undefined) {
            return 0;
        }

        if (oldClusters.length === 0) {
            return 0;
        }
        // console.log(oldClusters);
        // console.log(preloadVisibleStart);
        // console.log(mactime_entry);

        // how many entries before given mactime_entry left or were added
        // add to both old and new the criterium time  get the number of results and count difference,

        const old_number = await this.clusterDao.getNumberOfEntries(this.case, oldClusters, mactime_entry._source['@timestamp']);
        const new_number = await this.clusterDao.getNumberOfEntries(this.case, this.clusters, mactime_entry._source['@timestamp']);
        console.log(old_number);
        console.log(new_number);

        console.log(new_number - old_number);


        return new_number - old_number;
    }

    countEntriesOfClusters(additionalFilters) {
        for (const clust of this._clusters) {
            this.clusterDao.writeCountOfEntriesToCluster(clust, this._case, additionalFilters);
        }
    }
}