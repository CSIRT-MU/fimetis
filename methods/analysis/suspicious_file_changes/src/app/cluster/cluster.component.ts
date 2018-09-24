import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatSelectionList} from '@angular/material';

@Component({
  selector: 'app-cluster',
  templateUrl: './cluster.component.html',
  styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit {

  @ViewChild(MatSelectionList)
  clusterList: MatSelectionList;

  @Input('clusters')
  clusters: string[] = [];
  @Output('selectedClusters')
  selectedClusters: EventEmitter<string[]> = new EventEmitter<string[]>();
  @Input('selectAll')
  selectAll: boolean;

  computedClusterEmpty: boolean = (this.clusters.length > 0);

  savedClusters: any[];

  constructor() { }

  ngOnInit() {
  }

  emitSelectedClusters() {
    const selected = this.clusterList.selectedOptions.selected;
    const selClusters: string[] = [];
    for (const sel of selected) {
      selClusters.push(sel._text.nativeElement.innerText);
    }
    this.selectedClusters.emit(selClusters);
  }

}
