import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProductsComponent } from './products.component';
import { ProductDashboardComponent } from './product-dashboard/product-dashboard.component';
import { ReleasePlanDashboardComponent } from './releaseplan-dashboard/releaseplan-dashboard.component';
import { NodeDashboardComponent } from './nodedashboard/nodedashboard.component';

const routes: Routes = [
  { path: '', component: ProductsComponent },
  { path: 'products', component: ProductsComponent },
  { path: 'productdashboard', component: ProductDashboardComponent },
  { path: 'releaseplandashboard', component: ReleasePlanDashboardComponent },
  { path: 'nodedashboard', component: NodeDashboardComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
