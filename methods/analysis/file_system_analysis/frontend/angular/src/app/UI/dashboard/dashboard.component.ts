import {Component, OnInit, ViewChild, Input, AfterViewInit} from '@angular/core';
import {ListViewComponent} from '../listView/listView.component';
import {MatChipList, MatDialog, MatTabGroup} from '@angular/material';
import {FilterModel} from '../../models/filter.model';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';
import {ClusterModel} from '../../models/cluster.model';
import {GraphComponent} from '../graph/graph.component';
import {ConfigManager} from '../../../assets/configManager';
import {ClusterComponent} from '../cluster/cluster.component';
import {ToastrService} from 'ngx-toastr';
import {BaseService} from '../../services/base.service';
import {ClusterService} from '../../services/cluster.service';
import {AuthenticationService} from '../../auth/authentication.service';
import {UserSettingsService} from '../../services/userSettings.service';
import {ConfirmationDialogComponent} from '../dialog/confirmation-dialog/confirmation-dialog.component';
import {Hotkey, HotkeysService} from 'angular2-hotkeys';
import * as d3 from 'd3';
import {Subscription} from 'rxjs';
import {StateService} from '../../services/state.service';
import {CaseService} from '../../services/case.service';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit, AfterViewInit {
    advancedMode = false;

    /* collapse properties */
    setupWindowOpen = true;
    uploadWindowOpen = false;
    filterPanelOpenState = false;
    clusterPanelOpenState = true;

    cases: any[];
    selectedCase: string;

    editedClusters: Set<ClusterModel> = new Set<ClusterModel>();
    filters: any[];
    selectedFilter: string;
    selectedFilterModel: FilterModel = new FilterModel();
    // computations: Set<ComputationModel> = new Set<ComputationModel>();

    preloadedClusters: ClusterModel[] = [];
    manualClusters: ClusterModel[] = [];
    savedClusters: Set<ClusterModel> = new Set<ClusterModel>();
    clusters: Set<ClusterModel> = new Set<ClusterModel>();

    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    @ViewChild(ListViewComponent, {static: false})
    listViewComponent: ListViewComponent;

    @ViewChild(GraphComponent, {static: false})
    graphComponent: GraphComponent;

    @ViewChild(ClusterComponent, {static: false})
    clusterComponent: ClusterComponent;

    @ViewChild(MatTabGroup, {static: false})
    tabGroup: MatTabGroup;

    @ViewChild(MatChipList, {static: false})
    chipList: MatChipList;

    private subscriptions: Subscription[] = [];
    constructor(
                private caseService: CaseService,
                private baseService: BaseService,
                private clusterService: ClusterService,
                public authService: AuthenticationService,
                private toaster: ToastrService,
                public dialog: MatDialog,
                private userSettingsService: UserSettingsService,
                private _hotkeysService: HotkeysService,
                private stateService: StateService) {
        this.advancedMode = userSettingsService.advancedMode.getValue();
        this.subscriptions.push(this.stateService.currentStateSelectedCase.subscribe((value) => this.setCase(value)));
        this._hotkeysService.add(new Hotkey(['ctrl+s', 'command+s'], (event: KeyboardEvent): boolean => {
            this.saveApplicationState();
            return false; // Prevent bubbling
        }, undefined, 'Save application state'));
        this._hotkeysService.add(new Hotkey(['ctrl+l', 'command+l'], (event: KeyboardEvent): boolean => {
            this.restoreApplicationState();
            return false; // Prevent bubbling
        }, undefined, 'Load application state'));
    }

    ngOnInit() {
        this.loadAllCases();
        this.loadAllFilters();

        this.selectedCase = this.caseService.selectedCase;
        // console.log(this);
        // console.log(this.listViewComponent);
        // if (this.stateService.selectedCase !== undefined) {
        //     this.setupWindowOpen = false;
        //     this.selectedCase = this.stateService.selectedCase;
        //     console.log(this.listViewComponent);
        //     // while (this.listViewComponent === undefined) {
        //     //
        //     // }
        //     // while  (this.listViewComponent == null){ }
        //     console.log('listview setted');
        //     //this.listViewComponent.case = this.selectedCase;
        //
        //     //this.selectedCaseChanged();
        // }
        // this.caseService.selectedCase = this.selectedCase;
        // console.log(this.selectedCase);
    }

    ngAfterViewInit() {
        this.subscriptions.push(this.userSettingsService.advancedMode.subscribe(mode => {
            this.advancedModeToggle(mode);
        }));
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.clusters = this.getClusters();
    }

    ngOnDestroy() {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
    }

    loadAllCases() {
        this.baseService.getCases().then(
            response => {
                this.cases = response.cases;
            }, error => {
                console.error(error);
                this.toaster.error('Error:' + error['message'], 'Cannot load datasets');
            }).then(() => {
            // console.log('Show Cases completed!');
        });
    }

    loadAllFilters() {
        this.baseService.getFilters().then(
            response => {
                this.filters = response.filters;
            }, error => {
                console.error(error);
            }).then(() => {
            // console.log('Show Filters completed!');
        });
    }

    addNewFilterButton() {
        this.filterPanelOpenState = true;
        this.tabGroup.selectedIndex = 0;
    }

    /**
     * Method triggered by selecting Case
     */
    selectedCaseChanged() {
        this.stateService.selectedCase = this.selectedCase;
        this.setupWindowOpen = false;
        this.listViewComponent.case = this.selectedCase;
        this.initPreLoadedClusters().then(() => this.clusterSelectionChanged(null));
        // this.loadStoredClusters();
        this.listViewComponent.init();
        this.caseService.selectedCase = this.selectedCase;
        this.stateService.selectedCase = this.selectedCase;


    }

    setCase(caseName) {
        this.selectedCase = caseName;
        this.setupWindowOpen = false;
        this.listViewComponent.case = this.selectedCase;
        this.graphComponent._case = this.selectedCase;
        this.caseService.selectedCase = this.selectedCase;
    }

    /**
     * Method to initialize predefined clusters
     * @returns {Promise<void>} Returns predefined clusters
     */
    async initPreLoadedClusters() {
        this.preloadedClusters = [];
        const configManager = new ConfigManager();
        this.preloadedClusters = configManager.loadPreparedClusters()['prepared_clusters'];
        this.computeClustersItemCount(this.listViewComponent.additionalFilters);
        this.stateService.clusters = this.preloadedClusters;
    }

    /**
     * Method returns all clusters
     * @returns {ClusterModel[]} Returns all actual clusters
     */
    getClusters() {
        return this.preloadedClusters.concat(this.manualClusters).concat(Array.from(this.clusters)).concat(Array.from(this.savedClusters));
    }

    /* Loads filter from database */
    async loadFilter() {
        this.baseService.getFilterByName(this.selectedFilter)
            .then(
            result => {
                this.selectedFilterModel = result;
            }, error => {
                console.log('Loading filter by name - error', error);
                this.toaster.error(error.message, 'Cannot load filter');
            }
        );
    }

    /**
     * Triggered by changing mode of clusters (select, deselect, deduct)
     */
    clusterSelectionChanged($event) {
        this.listViewComponent.clusters = this.getClusters();
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.init();
        this.graphComponent.init();
        // this.setDateSliderBoundary();
    }

    // /**
    //  * Store selected cluster to persistent db
    //  */
    // // TODO save more tags - now only one combined filter is used - solved in cluster manager method (need to test it)
    // storeSelectedClusters() {
    //     console.log('store');
    //     for (const cluster of this.selectedComputedClusters) {
    //         this.es.addTag(
    //             this.selectedCase,
    //             this.combinedFilter,
    //             cluster
    //         ).then(
    //             response => {
    //                 if (response.failures.length < 1) {
    //                     console.log('No failures', response.failures);
    //                 }
    //             }, error => {
    //                 console.error(error);
    //             }).then(() => {
    //             console.log('Tag saved');
    //         });
    //         console.log(this.storedClusters);
    //         this.storedClusters.add(cluster.toString());
    //     }
    // }

    // /**
    //  * Remove selected cluster from persistent db if possible
    //  */
    // deleteSelectedStoredClusters() {
    //     // this.listViewComponent.displayedClusters = [];
    //     this.listViewComponent.init();
    //     for (const cluster of this.selectedStoredClusters) {
    //         this.es.removeTag(
    //             this.selectedCase,
    //             this.combinedFilter,
    //             this.selectedStoredClusters,
    //             cluster
    //         ).then(
    //             response => {
    //                 this.storedClusters.delete(cluster);
    //                 if (response.failures.length < 1) {
    //                     console.log('No failures', response.failures);
    //                 } else {
    //                     console.log(response);
    //                 }
    //             }, error => {
    //                 console.error(error);
    //             }).then(() => {
    //             console.log('Tag removed');
    //         });
    //     }
    // }

    // /**
    //  * Creates cluster by selection in list view
    //  */
    // createClusterFromSelection() {
    //     const namePrefix = 'custom-';
    //     const dialogRef = this.dialog.open(NameDialogComponent, {
    //         width: '350px',
    //         data: {
    //             title: 'Create new cluster',
    //             itemsNumber: this.listViewComponent.tableSelection.selected.length,
    //             placeholder: 'Type new cluster\'s name'
    //         }
    //     });
    //
    //     dialogRef.afterClosed().subscribe(result => {
    //         console.log('dialog closed', result);
    //         if (result != null) {
    //             const params = [];
    //             const values = [];
    //             for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
    //                 params.push('_id');
    //                 values.push(this.listViewComponent.tableSelection.selected[index]._id);
    //             }
    //             let filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
    //             console.log(filter);
    //             filter = ',' + filter;
    //             this.es.addTag(
    //                 this.selectedCase,
    //                 filter,
    //                 (namePrefix + result)
    //             ).then(
    //                 response => {
    //                     if (response.failures.length < 1) {
    //                         console.log('No failures', response.failures);
    //                     }
    //                 }, error => {
    //                     console.error(error);
    //                 }).then(() => {
    //                 console.log('Tag saved');
    //             });
    //             this.storedClusters.add((namePrefix + result));
    //             this.listViewComponent.tableSelection.clear();
    //         }
    //     });
    // }

    // /**
    //  * Creates filter by selection in list view
    //  */
    // createFilterFromSelection() {
    //     const dialogRef = this.dialog.open(NameDialogComponent, {
    //         width: '350px',
    //         data: {
    //             title: 'Create new filter',
    //             itemsNumber: this.listViewComponent.tableSelection.selected.length,
    //             placeholder: 'Type new filter\'s name'
    //         }
    //     });
    //     dialogRef.afterClosed().subscribe(result => {
    //         console.log('dialog closed', result);
    //         if (result != null) {
    //             const params = [];
    //             const values = [];
    //             const filterParams = [];
    //             for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
    //                 params.push('_id');
    //                 values.push(this.listViewComponent.tableSelection.selected[index]._id);
    //                 const filParam = new FilterParamModel();
    //                 filParam.name = '_id';
    //                 filParam.value = this.listViewComponent.tableSelection.selected[index]._id;
    //                 filterParams.push(filParam);
    //             }
    //             const filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
    //             const model = new FilterModel();
    //             model.name = result;
    //             model.completed = filter;
    //             model.params = filterParams;
    //             model.json = filter;
    //             this.appliedFilters.set(model.name, model);
    //             this.selectedAppliedFilters.add(model.name);
    //             this.appliedFiltersKeys.add(model.name);
    //             this.listViewComponent.tableSelection.clear();
    //             this.combineSelectedFilters();
    //         }
    //     });
    // }

    /**
     * If graph boundaries has changed this method tries to fill boundaries into filter params called FROM and TO
     * @param $event Graph emit event
     */
    changeDateBoundary(timeRanges) {
        // console.log($event, 'dashboard');
        // if ($event[0] !== undefined || $event[1] !== undefined) {
        //     for (const param of this.selectedFilterModel.params) {
        //         if (param.type === 'DATE') {
        //             if (param.name === 'FROM') {
        //                 param.value = $event[0].split('.')[0].replace(' ', 'T');
        //             }
        //             if (param.name === 'TO') {
        //                 param.value = $event[1].split('.')[0].replace(' ', 'T');
        //             }
        //         }
        //     }
        //     this.listViewComponent.timeRangeFilter(new Date($event[0]).toISOString(), new Date($event[1]).toISOString());
        // }
        this.listViewComponent.timeRangeFilter(timeRanges);
    }

    makeManualCluster(cluster: ClusterModel) {
        console.log('manual cluster', cluster);
        this.manualClusters = this.manualClusters.concat(cluster);
        this.clusterService.countData(this.selectedCase, cluster, this.listViewComponent.additionalFilters).then(
          response => {
              cluster.count = response.total;
              cluster.totalCount = response.totalAll;
          });
        this.clusterComponent.scrollListToBottom();
    }

    /**
     * Triggered by state change of one of the type checkboxes
     * @param type Type that changed state (select / deselect)
     */
    typeCheckboxChanged(type) {
        if (this.selectedTypes.has(type)) {
            this.selectedTypes.delete(type);
        } else {
            this.selectedTypes.add(type);
        }
        console.log(type, this.selectedTypes);
        this.listViewComponent.typeFilter(this.selectedTypes);
        this.graphComponent.showHideTrace(type);
    }

    selectedMetadataTypesChanged(selectedTypes: Set<string>) {
        this.selectedTypes = selectedTypes;
        this.listViewComponent.typeFilter(this.selectedTypes);
    }

    /**
     * Computes count of items in each cluster.
     * Trigered by change of additional filters (searching, date filter etc.) in list view
     * @param {Map<string, string>} additionalFilters Additional filters (search filter, date filter etc.)
     */
    // computeClustersItemCount(filters: Map<string, string>) {
    //     this.clusterService.countEntriesOfClusters(this.selectedCase, this.getClusters(), Array.from(filters.values()));
    // }
    computeClustersItemCount(additionalFilters: object) {
        this.clusterService.countEntriesOfClusters(this.selectedCase, this.getClusters(), additionalFilters);
    }

    /**
     * Resets selection mode of each cluster
     */
    resetClusterStates() {
        const allClusters = this.getClusters();
        for (const clust of allClusters) {
            clust.selectMode = 0;
        }
    }

    /**
     * Switch advanced mode
     * @param {boolean} advancedMode If true than advanced mode is turn on
     */
    advancedModeToggle(advancedMode: boolean) {
        if (this.advancedMode !== advancedMode) {
            this.advancedMode = advancedMode;
            this.resetClusterStates();
            this.clusterComponent.advancedMode = this.advancedMode;
            this.listViewComponent.init();
            this.graphComponent.init();
        }
    }

    /**
     * Add new cluster
     */
    addNewCluster() {
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
                this.manualClusters.push(cluster);
                this.editCluster(cluster);
                this.clusterComponent.scrollListToBottom();
            }
        });
    }

    /**
     * Edit selected cluster
     * @param {ClusterModel} cluster Selected cluster from cluster component
     */
    editCluster(cluster: ClusterModel) {
        this.editedClusters.add(cluster);
    }

    /**
     * End editing cluster
     */
    editDone(cluster: ClusterModel) {
        // this.editingCluster = null;
        this.editedClusters.delete(cluster);
        // this.filterPanelOpenState = false;
        this.computeClustersItemCount(this.listViewComponent.additionalFilters);
        this.listViewComponent.init();
        this.graphComponent.init();
    }

    /**
     * Save application state to local storage
     */
    saveApplicationState() {
        this.stateService.saveStateToLocalStorage();
        // localStorage.setItem('preloadedClusters', JSON.stringify(this.preloadedClusters));
        // localStorage.setItem('selectedCase', JSON.stringify(this.selectedCase));
        // localStorage.setItem('clusters', JSON.stringify(this.clusterComponent.clusters));
        // localStorage.setItem('preloadedClusters', JSON.stringify(this.preloadedClusters));
        // localStorage.setItem('manualClusters', JSON.stringify(this.manualClusters));
        // localStorage.setItem('savedClusters', JSON.stringify(this.savedClusters));
        // localStorage.setItem('fromDate', JSON.stringify(this.graphComponent.pickedFromDate));
        // localStorage.setItem('toDate', JSON.stringify(this.graphComponent.pickedToDate));
        // localStorage.setItem('additionalFilters', JSON.stringify(this.listViewComponent.additionalFilters));
        // localStorage.setItem('searchString', JSON.stringify(this.listViewComponent.searchString));
        // localStorage.setItem('scrollPosition', JSON.stringify(this.listViewComponent.virtualScroller.viewPortInfo.startIndex));
        // localStorage.setItem('pageNumber', JSON.stringify(this.listViewComponent.page_number));
        // localStorage.setItem('showAllTypes', JSON.stringify(this.graphComponent.showAllTypes));
        // localStorage.setItem('selectedTypes', JSON.stringify(Array.from(this.graphComponent.selectedTypes)));
        // localStorage.setItem('selectedTableColumns', JSON.stringify(Array.from(this.listViewComponent.displayedTableColumns)));
        // localStorage.setItem('selections', JSON.stringify(this.graphComponent.d3Histogram.selections));
        this.toaster.info('', 'Application state saved');
    }

    /**
     * Restore application state from local storage
     */
    restoreApplicationState() {
        this.stateService.restoreStateFromLocalStorage();
        // this.selectedCase = JSON.parse(localStorage.getItem('selectedCase'));
        // this.clusters = JSON.parse(localStorage.getItem('clusters'));
        // this.preloadedClusters = JSON.parse(localStorage.getItem('preloadedClusters'));
        // this.manualClusters = JSON.parse(localStorage.getItem('manualClusters'));
        // this.savedClusters = JSON.parse(localStorage.getItem('savedClusters'));
        // this.stateService.clusters = JSON.parse(localStorage.getItem('clusters'));
        // this.setupWindowOpen = false;
        // this.listViewComponent.case = this.selectedCase;
        // this.graphComponent._case = this.selectedCase;
        // this.listViewComponent.clusters = this.getClusters();
        // this.graphComponent._clusters = this.getClusters();
        // this.listViewComponent.additionalFilters = JSON.parse(localStorage.getItem('additionalFilters'));
        // this.listViewComponent.searchString = JSON.parse(localStorage.getItem('searchString'));
        // this.listViewComponent.displayedTableColumns = JSON.parse(localStorage.getItem('selectedTableColumns'));
        // this.listViewComponent.init().then(() => {
        //     this.listViewComponent.changePage(JSON.parse(localStorage.getItem('pageNumber')));
        //     this.listViewComponent.scrollToIndex(JSON.parse(localStorage.getItem('scrollPosition')));
        // });
        // this.graphComponent.showAllTypes = JSON.parse(localStorage.getItem('showAllTypes'));
        // this.graphComponent.selectedTypes.clear();
        // for (const item of JSON.parse(localStorage.getItem('selectedTypes'))) {
        //     this.graphComponent.selectedTypes.add(item);
        // }
        // this.graphComponent.allTypesTrigger();
        // this.graphComponent.init();
        // this.listViewComponent.scrollToIndex(JSON.parse(localStorage.getItem('scrollPosition')));
        // this.graphComponent.pickedFromDate = JSON.parse(localStorage.getItem('fromDate'));
        // this.graphComponent.pickedToDate = JSON.parse(localStorage.getItem('toDate'));
        // this.graphComponent.updateBoundary();
        // const selections = JSON.parse(localStorage.getItem('selections'));
        // const transformSelections = [];
        // for (const sel of selections) {
        //     transformSelections.push([new Date(sel[0]), new Date(sel[1])]);
        // }
        // this.graphComponent.d3Histogram.setSelections(transformSelections);
        this.toaster.info('', 'Application state restored');
    }

    /**
     * Ability to restore application state
     * @returns {any} Stored selected case if able to restore application state. Null otherwise
     */
    ableToRestoreState() {
        return JSON.parse(localStorage.getItem('selectedCase'));
    }

    /**
     *  Draw sliding window representing current scroll position in graph
     * @param {any} start Index of first item in current scroll position
     * @param {any} end Index of last item in current scroll position
     * @param {any} startDate String representing date of first item in current scroll position
     * @param {any} endDate String representing date of last item in current scroll position
     */
    drawActualScrollPosition([start, end, startDate, endDate]) {
        const fromDate = new Date(startDate);
        const fromUTC = new Date(fromDate.getTime() + (fromDate.getTimezoneOffset() * 60000));
        const toDate = new Date(endDate);
        const toUTC = new Date(toDate.getTime() + (toDate.getTimezoneOffset() * 60000));
        this.graphComponent.drawGraphSliderWindow(fromUTC.getTime(), toUTC.getTime());
    }

    /**
     * Removes selected case from database
     */
    removeSelectedCase() {
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            width: '350px',
            data: {
                title: 'Are you sure ?',
                message: 'You want to delete whole dataset',
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('confirmation dialog closed', result);
            if (result) {
                this.baseService.deleteCase(this.selectedCase).then(
                    response => {
                        console.log('Dataset deleted', response);
                        this.toaster.success('This dataset is going to be removed. It can take some time.', 'Delete successful');
                    }, error => {
                        console.error(error);
                        this.toaster.error('Error:' + error['message'], 'Cannot delete this dataset');
                    }).then(() => {
                    console.log('Delete completed!');
                });
                this.selectedCase = null;
                this.setupWindowOpen = true;
            }
        });
    }

    sendAdditionalFiltersToGraphComponent(additionalFilters: object) {
        this.graphComponent.additionalFilters = additionalFilters;
        this.graphComponent.loadFilteredData();
    }

    restorePreviousState(previous: boolean) {
        this.stateService.restoreState(previous);
    }

    ableToRestoreHistoryState(previous: boolean) {
        if (previous) {
            return this.stateService.stateIndex > 0;
        } else {
            return this.stateService.stateIndex < (this.stateService.stateHistory.length - 1);
        }
    }
}
