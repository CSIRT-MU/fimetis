import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AppRoutingModule} from './app-routing.module';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule, MatListModule} from '@angular/material';
import {BrowserAnimationsModule, NoopAnimationsModule} from '@angular/platform-browser/animations';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material';
import {MatChipsModule} from '@angular/material/chips';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material';
import {MatTabsModule} from '@angular/material/tabs';
import {MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';
import {PerfectScrollbarModule} from 'ngx-perfect-scrollbar';
import {MatTableModule} from '@angular/material';
import {MatCheckboxModule} from '@angular/material';
import {MatSortModule} from '@angular/material/sort';
import {MatDialogModule} from '@angular/material/dialog';
import {MatMenuModule} from '@angular/material/menu';
import {VirtualScrollerModule} from 'ngx-virtual-scroller';
import {MatTooltipModule} from '@angular/material';
import { ToastrModule } from 'ngx-toastr';
import { ngfModule } from 'angular-file';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {HotkeyModule} from 'angular2-hotkeys';
import {MatProgressBarModule} from '@angular/material/progress-bar';
// auth
import {JwtInterceptor} from './auth/jwt.interceptor';
import {ErrorInterceptor} from './auth/error.interceptor';
// app
import {AppComponent} from './app.component';
import {ListViewComponent} from './UI/listView/listView.component';
import {GraphComponent} from './UI/graph/graph.component';
import {DashboardComponent} from './UI/dashboard/dashboard.component';
import {ClusterComponent} from './UI/cluster/cluster.component';
import {NameDialogComponent} from './UI/dialog/name-dialog/name-dialog.component';
import {SelectDialogComponent} from './UI/dialog/select-dialog/select-dialog.component';
import {ComputationDialogComponent} from './UI/dialog/computation-dialog/computation-dialog.component';
import {ScrollDialogComponent} from './UI/dialog/scroll-dialog/scroll-dialog.component';
import {TextSelectDirective} from './UI/text-select.directive';
import {HighlightPipe} from './UI/highlight.directive';
import {UploadComponent} from './UI/upload/upload.component';
import {LoginComponent} from './UI/user/login/login.component';
import { FilterComponent } from './UI/filter/filter.component';
import {ConfirmationDialogComponent} from './UI/dialog/confirmation-dialog/confirmation-dialog.component';
import {D3HistogramComponent} from './UI/graph/d3Histogram/d3Histogram.component';
import {MatIconModule} from '@angular/material/icon';
import {MarkForbidenDialogComponent} from './UI/dialog/mark-all-forbiden-dialog/mark-forbiden-dialog.component';
import { CaseManagementComponent } from './UI/case-management/case-management.component';
import { AccessManagementComponent } from './UI/access-management/access-management.component';
import { NoteDialogComponent } from './UI/dialog/note-dialog/note-dialog.component';
import { MarkListDialogComponent } from './UI/dialog/mark-list-dialog/mark-list-dialog.component';
import { ClusterManagementComponent } from './UI/cluster-management/cluster-management.component';
import { AddClusterDefinitionComponent } from './UI/dialog/add-cluster-definition/add-cluster-definition.component';
import { SelectClustersComponent } from './UI/dialog/select-clusters/select-clusters.component';
import { SelectUsersComponent } from './UI/dialog/select-users/select-users.component';



@NgModule({
    declarations: [
        AppComponent,
        ListViewComponent,
        GraphComponent,
        DashboardComponent,
        ClusterComponent,
        NameDialogComponent,
        SelectDialogComponent,
        ComputationDialogComponent,
        ConfirmationDialogComponent,
        ScrollDialogComponent,
        MarkForbidenDialogComponent,
        TextSelectDirective,
        HighlightPipe,
        UploadComponent,
        LoginComponent,
        FilterComponent,
        D3HistogramComponent,
        CaseManagementComponent,
        AccessManagementComponent,
        NoteDialogComponent,
        MarkListDialogComponent,
        ClusterManagementComponent,
        AddClusterDefinitionComponent,
        SelectClustersComponent,
        SelectUsersComponent
    ],
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        AppRoutingModule,
        MatPaginatorModule,
        MatFormFieldModule,
        MatInputModule,
        BrowserAnimationsModule,
        NoopAnimationsModule,
        MatExpansionModule,
        MatListModule,
        MatCardModule,
        MatButtonModule,
        MatChipsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTabsModule,
        MatSelectModule,
        MatRadioModule,
        PerfectScrollbarModule,
        MatTableModule,
        MatCheckboxModule,
        MatSortModule,
        MatDialogModule,
        MatMenuModule,
        VirtualScrollerModule,
        MatTooltipModule,
        ToastrModule.forRoot({
            progressBar: true,
            positionClass: 'toast-bottom-left'
        }),
        ngfModule,
        HttpClientModule,
        MatButtonToggleModule,
        HotkeyModule.forRoot({cheatSheetCloseEsc: true}),
        MatProgressBarModule,
        MatIconModule
    ],
    entryComponents: [
        NameDialogComponent,
        SelectDialogComponent,
        ComputationDialogComponent,
        ConfirmationDialogComponent,
        ScrollDialogComponent,
        MarkForbidenDialogComponent,
        NoteDialogComponent,
        MarkListDialogComponent,
        AddClusterDefinitionComponent,
        SelectClustersComponent,
        SelectUsersComponent
    ],
    providers: [
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }],
    bootstrap: [AppComponent]
})

export class AppModule {
}
