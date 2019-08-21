import {ClusterModel} from './cluster.model';

export class StateModel {
    selectedCase: string;
    selectedTypes: Set<string> = new Set<string>();
    additionalFilters = {};
    selectedTableColumns: Set<string> = new Set<string>();
    showAllTypesSwitch = false;
    pageNumber = 0;
    scrollPosition = 0;
    clusters: Array<ClusterModel> = [];
    // preloadedClusters: Array<ClusterModel> = [];
    // manualClusters: Array<ClusterModel> = [];
    // savedClusters: Array<ClusterModel> = [];
    selections: Array<any> = [];
}
