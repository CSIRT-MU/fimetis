import {Component, OnInit, ViewChild} from '@angular/core';
import {ElasticsearchService} from '../../elasticsearch.service';
import {ListViewComponent} from '../listView/listView.component';
import {MatChipList, MatDialog, MatTabGroup} from '@angular/material';
import {FilterParamModel} from '../../models/filterParam.model';
import {FilterModel} from '../../models/filter.model';
import {NameDialogComponent} from '../dialog/name-dialog/name-dialog.component';
import {ComputationModel} from '../../models/computation.model';
import {ComputationDialogComponent} from '../dialog/computation-dialog/computation-dialog.component';
import {ClusterModel} from '../../models/cluster.model';
import {ClusterManager} from '../../businessLayer/clusterManager';
import {GraphComponent} from '../graph/graph.component';
import {ComputationManager} from '../../businessLayer/computationManager';
import {GraphManager} from '../../businessLayer/graphManager';
import {BaseManager} from '../../businessLayer/baseManager';
import {ElasticsearchBaseQueryManager} from '../../businessLayer/elasticsearchBaseQueryManager';
import {ConfigManager} from '../../../assets/configManager';
import {ClusterComponent} from '../cluster/cluster.component';
import {ToastrService} from 'ngx-toastr';
import {BaseService} from '../../services/base.service';
import {ClusterService} from '../../services/cluster.service';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})

export class DashboardComponent implements OnInit {
    clusterManager: ClusterManager;
    computationManager: ComputationManager;
    baseManager: BaseManager;
    elasticsearchBaseQueryManager: ElasticsearchBaseQueryManager;

    advancedMode = false;

    /* collapse properties */
    setupWindowOpen = true;
    filterPanelOpenState = false;
    computationPanelOpenState = true;
    clusterPanelOpenState = true;
    histogramPanelOpenState = true;

    cases: any[];
    selectedCase: string;

    editingCluster: ClusterModel = null;
    filters: any[];
    selectedFilter: string;
    selectedFilterModel: FilterModel = new FilterModel();
    computations: Set<ComputationModel> = new Set<ComputationModel>();
    pickedComputation: ComputationModel;
    combinedFilter: string;

    appliedFiltersKeys: Set<string> = new Set<string>();
    appliedFilters: Map<string, FilterModel> = new Map<string, FilterModel>();
    selectedAppliedFilters: Set<string> = new Set<string>();

    computedClusters: Set<string> = new Set<string>();
    selectedComputedClusters: string[] = [];
    storedClusters: Set<string> = new Set<string>();
    selectedStoredClusters: string[] = [];

    preloadedClusters: ClusterModel[] = [];
    manualClusters: ClusterModel[] = [];
    savedClusters: Set<ClusterModel> = new Set<ClusterModel>();
    clusters: Set<ClusterModel> = new Set<ClusterModel>();

    supportedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);
    selectedTypes: Set<string> = new Set<string>(['m', 'a', 'c', 'b']);

    @ViewChild(ListViewComponent)
    listViewComponent: ListViewComponent;

    @ViewChild(GraphComponent)
    graphComponent: GraphComponent;

    @ViewChild(ClusterComponent)
    clusterComponent: ClusterComponent;

    @ViewChild(MatTabGroup)
    tabGroup: MatTabGroup;

    @ViewChild(MatChipList)
    chipList: MatChipList;

    constructor(private es: ElasticsearchService, public dialog: MatDialog, private toaster: ToastrService, private baseService: BaseService, private clusterService: ClusterService) {
        this.clusterManager = new ClusterManager(this.es, this.clusterService);
        this.computationManager = new ComputationManager(this.es);
        this.baseManager = new BaseManager(this.es);
        this.elasticsearchBaseQueryManager = new ElasticsearchBaseQueryManager();

        // test only
        //   const comp = new ComputationModel();
        //   comp.color = '#336699';
        //   comp.name = 'test';
        //   const filt = new FilterModel();
        //   filt.name = 'test_filter';
        //   filt.isSelected = true;
        //   comp.filters.add(filt);
        //   const comp2 = new ComputationModel();
        //   comp2.color = '#cc0000';
        //   comp2.name = 'test2';
        //   comp2.isSelected = false;
        //   this.computations.add(comp);
        //   this.computations.add(comp2);
        //   this.pickedComputation = comp;
    }

    ngOnInit() {
        // this.dateSliderComponent.min = 0;
        // this.dateSliderComponent.max = 100;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.clusters = this.getClusters();

        this.loadAllCases();
        this.loadAllFilters();
        // this.collapse();
    }

    loadAllCases() {
        // this.baseService.getCases().subscribe(
        //     response => {
        //         this.cases = response['aggregations'].cases.buckets;
        //     }, error => {
        //         console.error(error);
        //         this.toaster.error('Error:' + error['message'], 'Cannot load datasets');
        //     }
        // );
        this.baseService.getCases().then(
            response => {
                this.cases = response.cases;
            }, error => {
                console.error(error);
                this.toaster.error('Error:' + error['message'], 'Cannot load datasets');
            }).then(() => {
            console.log('Show Cases completed!');
        });
    }

    loadAllFilters() {
        this.baseService.getFilters().then(
            response => {
                this.filters = response;
            }, error => {
                console.error(error);
            }).then(() => {
            console.log('Show Filters completed!');
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
        this.setupWindowOpen = false;
        this.listViewComponent.case = this.selectedCase;
        this.listViewComponent.displayedClusters = [];
        this.clusterManager.case = this.selectedCase;
        this.computationManager.case = this.selectedCase;
        this.initPreLoadedClusters();
        // this.loadStoredClusters();
        // this.clusteringOverview = this.computationManager.getPreloadedClusterings();
        this.listViewComponent.init();
    }

    /**
     * Loads stored clusters from db
     */
    loadStoredClusters() {
        this.clusterManager.getStoredClusters().then(
            response => {
                this.savedClusters = response;
            });
    }

    /**
     * Method to initialize predefined clusters
     * @returns {Promise<void>} Returns predefined clusters
     */
    async initPreLoadedClusters() {
        // preloaded clusters
        this.computationManager.computations = [];
        this.preloadedClusters = [];


        const configManager = new ConfigManager();
        //
        // const preparedComputationsFromJson = configManager.loadPreparedComputations()['prepared_computations'];
        //
        // const computationList: ComputationModel[] = JSON.parse(JSON.stringify(preparedComputationsFromJson));
        //
        // for (const comp of computationList) {
        //     this.computationManager.addComputation(comp);
        // }
        //
        // // for (let i = 0; i < preparedComputationsFromJson.length; i++) {
        //     // const tmpComputation = new ComputationModel();
        //     // tmpComputation.name = preparedComputationsFromJson[i]['name'];
        //     // tmpComputation.color = preparedComputationsFromJson[i]['color'];
        //     // tmpComputation.isSelected = preparedComputationsFromJson[i]['isSelected'];
        //     // tmpComputation.description = preparedComputationsFromJson[i]['description'];
        //     // tmpComputation.filters = new Set(preparedComputationsFromJson[i]['filters']);
        //     // this.computationManager.addComputation(tmpComputation);
        //
        // // }
        //
        // this.preloadedClusters = this.preloadedClusters.concat(this.computationManager.getClusters());

        this.preloadedClusters = configManager.loadPreparedClusters()['prepared_clusters'];
        this.computeClustersItemCount(this.listViewComponent.additionalFilters);
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
        this.baseManager.getFilterByName(this.selectedFilter)
            .then(
            result => {
                this.selectedFilterModel = result;
            }
        );
    }


    /**
     * Applies selected filter with inserted parameters
     */
    useFilter() {
        // if (this.selectedFilter == null) {
        //   this.combineSelectedFilters();
        // } else {
        //   this.selectedFilterModel.completed = this.fs.applyFilter(this.selectedFilterModel.json, this.selectedFilterModel.params);
        //   for (const oneParam of this.selectedFilterModel.params) {
        //     this.selectedFilterModel.name = this.selectedFilterModel.name + '-' + oneParam.name + ':' + oneParam.value;
        //   }
        //   // // copy object without reference
        //   // const copy = JSON.parse(JSON.stringify(this.selectedFilterModel));
        //   // this.appliedFilters.set(this.selectedFilterModel.name, copy);
        //   // this.selectedAppliedFilters.add(this.selectedFilterModel.name);
        //   // this.appliedFiltersKeys.add(this.selectedFilterModel.name);
        //   // this.combineSelectedFilters();
        // }
        if (this.pickedComputation != null) {
            if (this.pickedComputation.filters.indexOf(this.selectedFilterModel) < 0) {
                this.selectedFilterModel.isSelected = true;
                this.pickedComputation.filters.push(this.selectedFilterModel);
            }
            // if (!this.pickedComputation.filters.has(this.selectedFilterModel)) {
            //     this.selectedFilterModel.isSelected = true;
            //     this.pickedComputation.filters.add(this.selectedFilterModel);
            // }
        }
        this.selectedFilterModel = new FilterModel();
        this.selectedFilter = null;
        this.filterPanelOpenState = false;
    }

    /**
     * De/select given filter in computation
     * @param filter Filter model
     */
    selectFilter(filter) {
        if (this.selectedAppliedFilters.has(filter)) {
            this.selectedAppliedFilters.delete(filter);
        } else {
            this.selectedAppliedFilters.add(filter);
        }
        this.combineSelectedFilters();
        console.log(this.selectedAppliedFilters);
    }

    combineSelectedFilters() {
        let clusterName = 'cluster';
        let resFilter = '';
        this.selectedAppliedFilters.forEach((value) => {
            console.log(value);
            resFilter = this.elasticsearchBaseQueryManager.getFilterCombination([resFilter, this.appliedFilters.get(value).completed]);
            console.log(this.appliedFilters.get(value));
            clusterName = clusterName + '-' + value;
        });

        if (this.selectedAppliedFilters.size > 0) {
            this.combinedFilter = resFilter;
        } else {
            this.combinedFilter = null;
        }
        console.log(resFilter);
        this.listViewComponent.case = this.selectedCase;
        this.listViewComponent.filter = this.combinedFilter;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.listViewComponent.computations = Array.from(this.computations);
        this.listViewComponent.init();

        // TODO WARNING - only one cluster at a time
        this.computedClusters.clear();
        if (this.selectedAppliedFilters.size > 0) {
            this.computedClusters.add(clusterName);
            this.selectedComputedClusters = [];
            this.selectedComputedClusters.push(clusterName);
        }
    }

    setComputedClusters($event) {
        this.selectedComputedClusters = $event;
        if (this.selectedComputedClusters.length > 0) {
            this.listViewComponent.filter = this.combinedFilter;
            this.listViewComponent.init();
        } else {
            this.listViewComponent.filter = null;
            this.listViewComponent.init();
        }
    }

    /**
     * Triggered by changing mode of clusters (select, deselect, deduct)
     */
    clusterSelectionChanged($event) {
        console.log(this.clusters);
        console.log(this.getClusters());
        this.listViewComponent.clusters = this.getClusters();
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.init();
        this.graphComponent.init();
        // this.setDateSliderBoundary();
    }

    setStoredClusters($event) {
        this.selectedStoredClusters = $event;
        this.listViewComponent.displayedClusters = this.selectedStoredClusters;
        this.listViewComponent.init();
    }

    /**
     * Store selected cluster to persistent db
     */
    // TODO save more tags - now only one combined filter is used - solved in cluster manager method (need to test it)
    storeSelectedClusters() {
        console.log('store');
        for (const cluster of this.selectedComputedClusters) {
            this.es.addTag(
                this.selectedCase,
                this.combinedFilter,
                cluster
            ).then(
                response => {
                    if (response.failures.length < 1) {
                        console.log('No failures', response.failures);
                    }
                }, error => {
                    console.error(error);
                }).then(() => {
                console.log('Tag saved');
            });
            console.log(this.storedClusters);
            this.storedClusters.add(cluster.toString());
        }
    }

    /**
     * Remove selected cluster from persistent db if possible
     */
    deleteSelectedStoredClusters() {
        this.listViewComponent.displayedClusters = [];
        this.listViewComponent.init();
        for (const cluster of this.selectedStoredClusters) {
            this.es.removeTag(
                this.selectedCase,
                this.combinedFilter,
                this.selectedStoredClusters,
                cluster
            ).then(
                response => {
                    this.storedClusters.delete(cluster);
                    if (response.failures.length < 1) {
                        console.log('No failures', response.failures);
                    } else {
                        console.log(response);
                    }
                }, error => {
                    console.error(error);
                }).then(() => {
                console.log('Tag removed');
            });
        }
    }

    /**
     * Creates cluster by selection in list view
     */
    createClusterFromSelection() {
        const namePrefix = 'custom-';
        const dialogRef = this.dialog.open(NameDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new cluster',
                itemsNumber: this.listViewComponent.tableSelection.selected.length,
                placeholder: 'Type new cluster\'s name'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            console.log('dialog closed', result);
            if (result != null) {
                const params = [];
                const values = [];
                for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
                    params.push('_id');
                    values.push(this.listViewComponent.tableSelection.selected[index]._id);
                }
                let filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
                console.log(filter);
                filter = ',' + filter;
                this.es.addTag(
                    this.selectedCase,
                    filter,
                    (namePrefix + result)
                ).then(
                    response => {
                        if (response.failures.length < 1) {
                            console.log('No failures', response.failures);
                        }
                    }, error => {
                        console.error(error);
                    }).then(() => {
                    console.log('Tag saved');
                });
                this.storedClusters.add((namePrefix + result));
                this.listViewComponent.tableSelection.clear();
            }
        });
    }

    /**
     * Creates filter by selection in list view
     */
    createFilterFromSelection() {
        const dialogRef = this.dialog.open(NameDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new filter',
                itemsNumber: this.listViewComponent.tableSelection.selected.length,
                placeholder: 'Type new filter\'s name'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('dialog closed', result);
            if (result != null) {
                const params = [];
                const values = [];
                const filterParams = [];
                for (let index = 0; index < this.listViewComponent.tableSelection.selected.length; index++) {
                    params.push('_id');
                    values.push(this.listViewComponent.tableSelection.selected[index]._id);
                    const filParam = new FilterParamModel();
                    filParam.name = '_id';
                    filParam.value = this.listViewComponent.tableSelection.selected[index]._id;
                    filterParams.push(filParam);
                }
                const filter = this.elasticsearchBaseQueryManager.buildShouldMatchFilter(params, values);
                const model = new FilterModel();
                model.name = result;
                model.completed = filter;
                model.params = filterParams;
                model.json = filter;
                this.appliedFilters.set(model.name, model);
                this.selectedAppliedFilters.add(model.name);
                this.appliedFiltersKeys.add(model.name);
                this.listViewComponent.tableSelection.clear();
                this.combineSelectedFilters();
            }
        });
    }

    /**
     * If graph boundaries has changed this method tries to fill boundaries into filter params called FROM and TO
     * @param $event Graph emit event
     */
    changeDateBoundary($event) {
        console.log($event, 'dashboard');
        if ($event[0] !== undefined || $event[1] !== undefined) {
            for (const param of this.selectedFilterModel.params) {
                if (param.type === 'DATE') {
                    if (param.name === 'FROM') {
                        param.value = $event[0].split('.')[0].replace(' ', 'T');
                    }
                    if (param.name === 'TO') {
                        param.value = $event[1].split('.')[0].replace(' ', 'T');
                    }
                }
            }
            this.listViewComponent.timeRangeFilter(new Date($event[0]).toISOString(), new Date($event[1]).toISOString());
        }
    }

    /**
     * Adds new computation
     */
    addComputation() {
        const dialogRef = this.dialog.open(ComputationDialogComponent, {
            width: '350px',
            data: {
                title: 'Create new clustering',
                namePlaceholder: 'Type new clustering\'s name',
                colorPlaceHolder: 'Select clustering color'
            }
        });
        dialogRef.afterClosed().subscribe(result => {
            console.log('computation dialog closed', result);
            if (result != null) {
                const comp = new ComputationModel();
                comp.name = result[0];
                comp.color = result[1];
                this.computations.add(comp);
            }
        });
    }

    /**
     * Adds filter to given computation
     * @param computation Computation to add new filter to
     */
    addFilter(computation) {
        this.filterPanelOpenState = true;
        this.pickedComputation = computation;
        console.log(this.pickedComputation);
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event
     * @param {FilterModel} filter
     * @param {ComputationModel} computation
     */
    dragFilter($event, filter: FilterModel, computation: ComputationModel) {
        $event.dataTransfer.setData('filter', JSON.stringify(filter));
        $event.dataTransfer.dropEffect = 'copy';
        $event.effectAllowed = 'copyMove';
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event Drag event
     */
    dragOver($event) {
        $event.preventDefault();
    }

    /**
     * Method to drag and drop filters between computations
     * @param $event Drop event
     * @param {ComputationModel} computation Target computation
     */
    dropFilter($event, computation: ComputationModel) {
        console.log('dropped', computation);
        $event.preventDefault();
        const filter = JSON.parse($event.dataTransfer.getData('filter'));
        console.log('filter', filter);
        // computation.filters.add(filter);
        computation.filters.push(filter);
    }

    /**
     * Delete given filter from given computation
     * @param {FilterModel} filter Filter model
     * @param {ComputationModel} computation Computation to delete filter from
     */
    deleteFilter(filter: FilterModel, computation: ComputationModel) {
        const index = computation.filters.indexOf(filter);
        if (index !== -1) {
            computation.filters.splice(index, 1);
        }
        // computation.filters.delete(filter);
    }

    /**
     * Edit given filter of given computation
     * @param {FilterModel} filter
     * @param {ComputationModel} computation
     */
    editFilter(filter: FilterModel, computation: ComputationModel) {
        this.selectedFilterModel = filter;
        this.pickedComputation = computation;
        this.selectedFilter = filter.name;
        this.filterPanelOpenState = true;
    }

    /**
     * Copy given filter
     * @param {FilterModel} filter
     */
    copyFilter(filter: FilterModel) {
        this.selectedFilterModel = JSON.parse(JSON.stringify(filter));
        this.selectedFilter = this.selectedFilterModel.name;
        this.filterPanelOpenState = true;
    }

    /**
     * Compute clusters from all computations
     */
    computeComputations() {
        console.log('compute');
        this.computationManager.case = this.selectedCase;
        this.computationManager.computations = Array.from(this.computations);
        // this.clusteringOverview = this.computationManager.getClusterings();
        const clusters = this.computationManager.getClusters();
        this.clusters.clear();
        for (const cluster of clusters) {
            this.clusters.add(cluster);
            console.log('added/', cluster);
        }
    }

    /**
     * Compute clusters from given computation
     * @param {ComputationModel} computation
     */
    // TODO method that computes clustering overview only for selected computation
    computeSelectedComputation(computation: ComputationModel) {
        console.log(computation);
        this.computeComputations();
    }

    makeManualCluster(computation: ComputationModel) {
        console.log('comp', computation);
        this.computationManager.computations = [];
        this.computationManager.addComputation(computation);
        this.manualClusters = this.manualClusters.concat(this.computationManager.getClusters());
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
     * @param {Map<string, string>} filters Additional filters (search filter, date filter etc.)
     */
    computeClustersItemCount(filters: Map<string, string>) {
        // filters.delete('searchString');
        const clustManager = new ClusterManager(this.es, this.clusterService);
        clustManager.clusters = this.getClusters();
        clustManager.case = this.selectedCase;
        clustManager.countEntriesOfClusters(Array.from(filters.values()));
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
        this.advancedMode = advancedMode;
        this.resetClusterStates();
        this.clusterComponent.advancedMode = this.advancedMode;
        // this.ngOnInit();
        if (!advancedMode) {
            this.editClusterDone();
        }
        this.listViewComponent.init();
        this.graphComponent.init();
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
                const comp = new ComputationModel();
                comp.name = result[0];
                comp.color = result[1];
                const cluster = new ClusterModel();
                cluster.name = result[0];
                cluster.color = result[1];
                cluster.computation = comp;
                cluster.count = 0;
                this.manualClusters.push(cluster);
                this.editCluster(cluster);
            }
        });
    }

    /**
     * Edit selected cluster
     * @param {ClusterModel} cluster Selected cluster from cluster component
     */
    editCluster(cluster: ClusterModel) {
        this.editingCluster = cluster;
    }

    /**
     * Hide cluster edit window and count items in clusters
     */
    editClusterDone() {
        this.editingCluster = null;
        this.filterPanelOpenState = false;
        this.computeClustersItemCount(this.listViewComponent.additionalFilters);
        this.listViewComponent.init();
        this.graphComponent.init();
    }

    /**
     * Save application state to local storage
     */
    saveApplicationState() {
        localStorage.setItem('preloadedClusters', JSON.stringify(this.preloadedClusters));
        localStorage.setItem('selectedCase', JSON.stringify(this.selectedCase));
        localStorage.setItem('clusters', JSON.stringify(this.clusters));
        localStorage.setItem('preloadedClusters', JSON.stringify(this.preloadedClusters));
        localStorage.setItem('manualClusters', JSON.stringify(this.manualClusters));
        localStorage.setItem('savedClusters', JSON.stringify(this.savedClusters));
        localStorage.setItem('fromDate', JSON.stringify(this.graphComponent.pickedFromDate));
        localStorage.setItem('toDate', JSON.stringify(this.graphComponent.pickedToDate));
        localStorage.setItem('scrollPosition', JSON.stringify(this.listViewComponent.virtualScroller.viewPortInfo.startIndex));
        localStorage.setItem('pageNumber', JSON.stringify(this.listViewComponent.page_number));
        localStorage.setItem('advancedMode', JSON.stringify(this.advancedMode));
    }

    /**
     * Restore application state from local storage
     */
    restoreApplicationState() {
        this.advancedMode = JSON.parse(localStorage.getItem('advancedMode'));
        this.selectedCase = JSON.parse(localStorage.getItem('selectedCase'));
        this.clusters = JSON.parse(localStorage.getItem('clusters'));
        this.preloadedClusters = JSON.parse(localStorage.getItem('preloadedClusters'));
        this.manualClusters = JSON.parse(localStorage.getItem('manualClusters'));
        this.savedClusters = JSON.parse(localStorage.getItem('savedClusters'));
        this.setupWindowOpen = false;
        this.listViewComponent.case = this.selectedCase;
        this.listViewComponent.displayedClusters = [];
        this.clusterManager.case = this.selectedCase;
        this.computationManager.case = this.selectedCase;
        this.listViewComponent.case = this.selectedCase;
        this.graphComponent._case = this.selectedCase;
        this.listViewComponent.clusters = this.getClusters();
        this.graphComponent._clusters = this.getClusters();
        this.listViewComponent.init().then(() => {
            this.listViewComponent.changePage(JSON.parse(localStorage.getItem('pageNumber')));
            this.listViewComponent.scrollToIndex(JSON.parse(localStorage.getItem('scrollPosition')));
        });
        this.graphComponent.init();
        this.listViewComponent.scrollToIndex(JSON.parse(localStorage.getItem('scrollPosition')));
        this.graphComponent.pickedFromDate = JSON.parse(localStorage.getItem('fromDate'));
        this.graphComponent.pickedToDate = JSON.parse(localStorage.getItem('toDate'));
        this.graphComponent.updateBoundary();
    }

    /**
     * Ability to restore application state
     * @returns {any} Stored selected case if able to restore application state. Null otherwise
     */
    ableToRestoreState() {
        return JSON.parse(localStorage.getItem('selectedCase'));
    }

}
