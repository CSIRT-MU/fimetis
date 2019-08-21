import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import {ClusterModel} from '../models/cluster.model';
import {StateModel} from '../models/state.model';
import * as lodash from 'lodash';
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StateService {
    private state = new StateModel();
    stateHistory: Array<StateModel> = [];
    stateIndex = -1;
    stateSubject: BehaviorSubject<StateModel> = new BehaviorSubject(this.state);
    selectionsSubject: BehaviorSubject<Array<any>> = new BehaviorSubject([]);
    clustersSubject: BehaviorSubject<Array<any>> = new BehaviorSubject([]);
    additionalFiltersSubject: BehaviorSubject<object> = new BehaviorSubject({});
    public currentState: Observable<StateModel>;
    public currentStateSelections: Observable<Array<any>>;
    public currentStateClusters: Observable<Array<any>>;
    public currentStateAdditionalFilters: Observable<object>;

    constructor(
        private _location: Location
    ) {
        this.currentState = this.stateSubject.asObservable();
        this.currentStateSelections = this.selectionsSubject.asObservable();
        this.currentStateClusters = this.clustersSubject.asObservable();
        this.currentStateAdditionalFilters = this.additionalFiltersSubject.asObservable();
    }

    getState() {
        return this.state;
    }

    get selectedCase(): string {
        return this.state.selectedCase;
    }

    set selectedCase(value: string) {
        this.state.selectedCase = value;
        this.stateSubject.next(this.state);
        this.saveState();
    }

    get selectedTypes(): Set<string> {
        return this.state.selectedTypes;
    }

    set selectedTypes(value: Set<string>) {
        this.state.selectedTypes = value;
        this.stateSubject.next(this.state);
    }

    get additionalFilters(): object {
        return this.state.additionalFilters;
    }

    set additionalFilters(value: object) {
        this.state.additionalFilters = value;
        this.stateSubject.next(this.state);
        this.additionalFiltersSubject.next(this.state.additionalFilters);
        console.log('change state add filt', value);
        // this.saveState();
    }

    get selectedTableColumns(): Set<string> {
        return this.state.selectedTableColumns;
    }

    set selectedTableColumns(value: Set<string>) {
        this.state.selectedTableColumns = value;
        this.stateSubject.next(this.state);
    }

    get showAllTypesSwitch(): boolean {
        return this.state.showAllTypesSwitch;
    }

    set showAllTypesSwitch(value: boolean) {
        this.state.showAllTypesSwitch = value;
        this.stateSubject.next(this.state);
    }

    get pageNumber(): number {
        return this.state.pageNumber;
    }

    set pageNumber(value: number) {
        this.state.pageNumber = value;
        this.stateSubject.next(this.state);
    }

    get scrollPosition(): number {
        return this.state.scrollPosition;
    }

    set scrollPosition(value: number) {
        this.state.scrollPosition = value;
    }

    get clusters(): Array<ClusterModel> {
        return this.state.clusters;
    }

    set clusters(value: Array<ClusterModel>) {
        this.state.clusters = value;
        this.stateSubject.next(this.state);
        this.clustersSubject.next(this.state.clusters);
        this.saveState();
    }

    addCluster(value: ClusterModel) {
        this.state.clusters.push(value);
        this.stateSubject.next(this.state);
        this.clustersSubject.next(this.state.clusters);
        this.saveState();
    }

    get selections(): Array<[string, string]> {
        return this.state.selections;
    }

    set selections(value) {
        this.state.selections = value;
        this.stateSubject.next(this.state);
        this.selectionsSubject.next(this.state.selections);
        this.saveState();
    }

    saveState() {
        this.stateIndex++;
        const deleteStates = this.stateHistory.length - (this.stateIndex + 1);
        this.stateHistory.splice(this.stateIndex, deleteStates);
        this.stateHistory.push(JSON.parse(JSON.stringify(this.state)));
        console.log('state history', this.stateHistory);
    }

    restoreState(previous: boolean) {
        console.log('stateIndex', this.stateIndex, ' states: ', this.stateHistory);
        if (previous) {
            if (this.stateIndex !== 0) {
                this.stateIndex--;
                this.state = JSON.parse(JSON.stringify(this.stateHistory[this.stateIndex]));
                this.stateSubject.next(this.state);
                this.selectionsSubject.next(this.state.selections);
                this.clustersSubject.next(this.state.clusters);
                this.additionalFiltersSubject.next(this.state.additionalFilters);
            } else {
                // this._location.back();
            }
        } else {
            if ((this.stateIndex + 1) !== this.stateHistory.length) {
                this.stateIndex++;
                this.state = JSON.parse(JSON.stringify(this.stateHistory[this.stateIndex]));
                this.stateSubject.next(this.state);
                this.selectionsSubject.next(this.state.selections);
                this.clustersSubject.next(this.state.clusters);
                this.additionalFiltersSubject.next(this.state.additionalFilters);
            } else {
                // this._location.forward();
            }
        }
        console.log('restore state', this.state);
    }

    saveStateToLocalStorage() {
        localStorage.setItem('selectedCase', JSON.stringify(this.state.selectedCase));
        localStorage.setItem('clusters', JSON.stringify(this.state.clusters));
        localStorage.setItem('preloadedClusters', JSON.stringify(this.state.preloadedClusters));
        localStorage.setItem('manualClusters', JSON.stringify(this.state.manualClusters));
        localStorage.setItem('savedClusters', JSON.stringify(this.state.savedClusters));
        // localStorage.setItem('additionalFilters', JSON.stringify([...this.listViewComponent.additionalFilters]));
        localStorage.setItem('scrollPosition', JSON.stringify(this.state.scrollPosition));
        localStorage.setItem('pageNumber', JSON.stringify(this.state.pageNumber));
        localStorage.setItem('showAllTypes', JSON.stringify(this.state.showAllTypesSwitch));
        localStorage.setItem('selectedTypes', JSON.stringify(Array.from(this.state.selectedTypes)));
        localStorage.setItem('selectedTableColumns', JSON.stringify(Array.from(this.state.selectedTableColumns)));
    }

    transformSelections(selections): Array<[string, string]> {
        const allSelections: Array<[string, string]> = [];
        for (const sel of selections) {
            const fromUTCDateTime = new Date(sel[0]).getTime() - new Date(sel[0]).getTimezoneOffset() * 60000;
            const toUTCDateTime = new Date(sel[1]).getTime() - new Date(sel[1]).getTimezoneOffset() * 60000;
            allSelections.push([
                new Date(fromUTCDateTime).toISOString(),
                new Date(toUTCDateTime).toISOString()
            ]);
        }
        return allSelections;
    }
}
