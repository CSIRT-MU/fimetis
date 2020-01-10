import {Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatDialog, MatSelectionList} from '@angular/material';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';
import {debounceTime} from 'rxjs/operators';
import {Subject, Subscription} from 'rxjs';
import {StateService} from '../../services/state.service';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';
import {ClusterService} from '../../services/cluster.service';
import {SelectClustersComponent} from '../dialog/select-clusters/select-clusters.component';
import {FilterModel} from '../../models/filter.model';
import {FilterParamModel} from '../../models/filterParam.model';


@Component({
    selector: 'app-cluster',
    templateUrl: './cluster.component.html',
    styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit, OnDestroy {

    @ViewChild(MatSelectionList, {static: false})
    clusterList: MatSelectionList;

    @Input('clusters')
    clusters: ClusterModel[] = [];
    @Input('advancedMode')
    advancedMode = false;
    @Output('selectionChanged')
    selectionChanged: EventEmitter<any> = new EventEmitter<any>();
    // debouncer is used to emit values once in a time. Solves the problem with a lot of calls to db
    clusterSelectionDebouncer: Subject<any> = new Subject();
    @Output('addNewCluster')
    addNewCluster: EventEmitter<any> = new EventEmitter<any>();
    @Output('editCluster')
    editCluster: EventEmitter<ClusterModel> = new EventEmitter<ClusterModel>();

    @ViewChild('scrollBlock', {static: false})
    scrollableBlock: ElementRef;

    clusterPanelOpenState = true;
    private subscriptions: Subscription[] = [];

    constructor(private stateService: StateService,
                private dialog: MatDialog,
                private clusterService: ClusterService) {
        // this.clusterSelectionDebouncer.pipe(debounceTime(500)).subscribe((value) => this.selectionChanged.emit(value));
        this.subscriptions.push(this.clusterSelectionDebouncer.pipe(debounceTime(500)).subscribe((value) => this.stateService.clusters = value));
        this.subscriptions.push(this.stateService.currentStateClusters.subscribe((value) => this.clusters = value));
        this.subscriptions.push(this.stateService.currentStateAdditionalFilters.subscribe((value) => this.computeClustersItemCount(value)));
    }

    ngOnInit() {
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    /**
     * Changes mode of given cluster by mode (mode 0: selected, not selected else: selected, not selected, deducted)
     * @param cluster Cluster model
     */
    nextVal(cluster) {
        if (!this.advancedMode) {
            for (const clust of this.clusters) {
                clust.selectMode = ClusterSelectMode.notSelected;
            }
            cluster.selectMode = ClusterSelectMode.added;
            this.clusterSelectionDebouncer.next(this.clusters);
        } else {
            cluster.selectMode = ClusterSelectMode.next(cluster.selectMode);
            if (cluster.subClusters.length > 0) {
                for (const clust of cluster.subClusters) {
                    clust.selectMode = cluster.selectMode;
                }
            }
            this.clusterSelectionDebouncer.next(this.clusters);
        }
    }

    edit(cluster) {
        this.editCluster.emit(cluster);
    }

    addCluster() {
        // this.addNewCluster.emit(null);
        const dialogRef = this.dialog.open(ComputationDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new cluster',
                namePlaceholder: 'Type new cluster\'s name',
                colorPlaceHolder: 'Select cluster color'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('cluster dialog closed', result);
            if (result != null) {
                const cluster = new ClusterModel();
                cluster.name = result[0];
                cluster.color = result[1];
                cluster.count = 0;
                cluster.totalCount = 0;
                this.stateService.addCluster(cluster);
                this.editCluster.emit(cluster);
                this.scrollListToBottom();
            }
        });

    }

    scrollListToBottom() {
        // we need to wait for loading new list of data
        setTimeout(() => {
            this.scrollableBlock.nativeElement.scrollTop = this.scrollableBlock.nativeElement.scrollHeight;
        }, 100);
    }

    getPercentageValue(cluster: ClusterModel) {
        const onePercent = cluster.totalCount / 100;
        if (onePercent !== 0) {
            if (cluster.count > 0) {
                return Math.max(1, cluster.count / onePercent);
            } else {
                return 0;
            }
        } else {
            // if total is zero
            return 0;
        }
    }

    selectedClustersCount() {
        let num = 0;
        if (this.advancedMode) {
            for (const cluster of this.clusters) {
                if (cluster.selectMode !== ClusterSelectMode.notSelected) {
                    num ++;
                }
            }
        }
        return num;
    }

    deselectAllClusters() {
        for (const cluster of this.clusters) {
            cluster.selectMode = ClusterSelectMode.notSelected;
        }
        this.clusterSelectionDebouncer.next(null);
    }

    computeClustersItemCount(additionalFilters: object) {
        this.clusterService.countEntriesOfClusters(this.stateService.selectedCase, this.clusters, additionalFilters);
    }

    async manageClusters() {
        const dialogRef = this.dialog.open(SelectClustersComponent, {
            data: {
                currentClustersIds: this.getCurrentClustersIds(),
                allClusters: await this.getAllClusters()
            },
            minWidth: '75%',
            maxHeight: '80%',
            overflow-y: 'scroll'

        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                const currentClusters = this.getCurrentClustersIds();
                const currentClustersInArray = Array.from(currentClusters);
                const newClusters = result;
                const newClustersInArray = Array.from(result);

                const clustersToAdd = [];

                for (let i = 0; i < newClustersInArray.length; i++) {
                    if (!currentClusters.has(newClustersInArray[i])) {
                        clustersToAdd.push(newClustersInArray[i]);
                    }
                }

                const clustersToDel = [];

                for (let i = 0; i < currentClustersInArray.length; i++) {
                    if (!newClusters.has(currentClustersInArray[i])) {
                        clustersToDel.push(currentClustersInArray[i]);
                    }
                }

                this.updateClusters(clustersToAdd, clustersToDel);
            }
        });


    }

    async getAllClusters() {
        const clusters = (await  this.clusterService.loadClustersFromDatabase()).cluster_definitions;
        return (await this.clusterService.loadClustersFromDatabase()).cluster_definitions;
    }

    getCurrentClustersIds() {
        const ids = new Set();
        for (let i = 0; i < this.clusters.length; i++) {
            ids.add(this.clusters[i].id);
        }

        return ids;
    }

    async updateClusters(clustersToAdd, clustersToDel) {
        await this.clusterService.addUserClustersForCase(this.stateService.selectedCase, clustersToAdd);
        await this.clusterService.deleteUserClustersForCase(this.stateService.selectedCase, clustersToDel);

        // save manual clusters
        const manualClusters = [];
        for (let i = 0; i < this.clusters.length; i++) {
            if (this.clusters[i].filters[0].name === 'highlighted_text') {
                manualClusters.push(this.clusters[i]);
            }
        }

        this.clusters = [];


        const loaded_from_db = (await this.clusterService.loadClustersForUserAndCase(this.stateService.selectedCase)).cluster_definitions;

        for (let i = 0; i < loaded_from_db.length; i++) {
            const db_cluster = new ClusterModel;

            db_cluster.id = loaded_from_db[i].id;
            db_cluster.color = '#886644';
            db_cluster.name = loaded_from_db[i].name;
            console.log(db_cluster.name);
            db_cluster.count = 0;
            db_cluster.totalCount = 0;
            db_cluster.selectMode = 0;
            db_cluster.description = 'description';

            const filter = new FilterModel();
            filter.isSelected = true;
            filter.name = 'filename_regex';
            filter.json = loaded_from_db[i].filter_definition;


            const filter_param = new FilterParamModel();

            if (loaded_from_db[i].filter_name === 'Select All') {
                filter_param.name = 'Select All';
                db_cluster.selectMode = 1;
            } else {
                filter_param.name = filter.json.match(/.*\${{(.*)}}\$.*/)[1];
            }
            filter_param.type = 'REGEX';
            filter_param.value = loaded_from_db[i].definition;

            filter.params.push(filter_param);
            db_cluster.filters.push(filter);

            this.clusters.push(db_cluster);

        }

        for (let i = 0; i < manualClusters.length; i++) {
            this.clusters.push(manualClusters[i]);
        }

        this.computeClustersItemCount(this.stateService.additionalFilters);
        this.clusterSelectionDebouncer.next(this.clusters);
    }





}
