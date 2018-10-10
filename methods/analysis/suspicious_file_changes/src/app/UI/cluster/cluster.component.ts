import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MatSelectionList} from '@angular/material';
import {ClusterModel, ClusterSelectMode} from '../../models/cluster.model';

@Component({
  selector: 'app-cluster',
  templateUrl: './cluster.component.html',
  styleUrls: ['./cluster.component.css']
})
export class ClusterComponent implements OnInit {

  @ViewChild(MatSelectionList)
  clusterList: MatSelectionList;

  @Input('clusters')
  clusters: ClusterModel[] = [];
  @Output('selectionChanged')
  selectionChanged: EventEmitter<any> = new EventEmitter<any>();

  constructor() { }

  ngOnInit() {
  }

  // emitSelectedClusters() {
  //   const selected = this.clusterList.selectedOptions.selected;
  //   const selClusters: string[] = [];
  //   for (const sel of selected) {
  //     selClusters.push(sel._text.nativeElement.innerText);
  //   }
  //   this.selectedClusters.emit(selClusters);
  // }

  nextVal(cluster) {
      cluster.selectMode = ClusterSelectMode.next(cluster.selectMode);
      this.selectionChanged.emit(null);
  }

}