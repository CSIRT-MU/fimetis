import {FilterModel} from './filter.model';

export class ClusterModel {
    name: string;
    color: string;
    count: number;
    // computation: ComputationModel;
    filters: FilterModel[] = [];
    tagged = false;
    tag: string;
    selectMode: ClusterSelectMode = ClusterSelectMode.notSelected;
    subClusters: ClusterModel[] = [];
    description = '';
}

export enum ClusterSelectMode {
    notSelected = 0,
    added = 1,
    deducted = 2
}

export namespace ClusterSelectMode {
    export function next(mode: ClusterSelectMode): ClusterSelectMode {
        return ((mode + 1) % 3) as ClusterSelectMode;
    }
}
