import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { ChooseFileComponent } from './choose-file.component';
import { MeasureComponent } from './measure.component';

const appRoutes: Routes = [
    { path: 'measure', component: MeasureComponent },
    { path: 'choose-file', component: ChooseFileComponent },
    { path: '**', redirectTo: '/measure', pathMatch: 'full' },
    //{ path: '', redirectTo: '/measure', pathMatch: 'full' },
    //{ path: '**', component: AppComponent },
];

@NgModule({
    imports: [
        RouterModule.forRoot(
            appRoutes,
            //{ enableTracing: true } // <-- debugging only
        ),
    ],
    exports: [
        RouterModule,
    ],
})
export class AppRoutingModule {}
