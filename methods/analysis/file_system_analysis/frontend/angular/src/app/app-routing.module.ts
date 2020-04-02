import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {UploadComponent} from './UI/upload/upload.component';
import {DashboardComponent} from './UI/dashboard/dashboard.component';
import {AuthGuard} from './auth/auth.guard';
import {LoginComponent} from './UI/user/login/login.component';
import {CaseManagementComponent} from './UI/case-management/case-management.component';
import {ClusterManagementComponent} from './UI/cluster-management/cluster-management.component';
import {AuthCallbackComponent} from './UI/user/auth-callback/auth-callback.component';
import {UserGroupManagementComponent} from './UI/user-group-management/user-group-management.component';
import {UserProfileComponent} from './UI/user/user-profile/user-profile.component';

const routes: Routes = [
    {path: '', component: DashboardComponent, canActivate: [AuthGuard]},
    {path: 'upload/:case', component: UploadComponent, canActivate: [AuthGuard]},
    {path: 'case-management', component: CaseManagementComponent, canActivate: [AuthGuard]},
    {path: 'cluster-management', component: ClusterManagementComponent, canActivate: [AuthGuard]},
    {path: 'login', component: LoginComponent},
    {path: 'auth-callback', component: AuthCallbackComponent},
    {path: 'user-group-management', component: UserGroupManagementComponent, canActivate: [AuthGuard]},
    {path: 'user-profile', component: UserProfileComponent, canActivate: [AuthGuard]},
    {path: '**', redirectTo: ''}
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
