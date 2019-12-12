import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {UploadComponent} from './UI/upload/upload.component';
import {DashboardComponent} from './UI/dashboard/dashboard.component';
import {AuthGuard} from './auth/auth.guard';
import {LoginComponent} from './UI/user/login/login.component';
import {CaseManagementComponent} from './UI/case-management/case-management.component';
import {ClusterManagementComponent} from './UI/cluster-management/cluster-management.component';

const routes: Routes = [
    {path: '', component: DashboardComponent, canActivate: [AuthGuard]},
    {path: 'upload/:case', component: UploadComponent, canActivate: [AuthGuard]},
    {path: 'case-management', component: CaseManagementComponent, canActivate: [AuthGuard]},
    {path: 'cluster-management', component: ClusterManagementComponent, canActivate: [AuthGuard]},
    {path: 'login', component: LoginComponent},
    {path: '**', redirectTo: ''}
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
