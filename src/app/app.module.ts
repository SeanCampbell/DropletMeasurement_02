import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatButtonModule, MatCardModule, MatIconModule, MatInputModule, MatSelectModule, MatListModule, MatTableModule } from '@angular/material';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ChooseFileComponent } from './choose-file.component';
import { ChooseFileService } from './choose-file.service';
import { DropletCanvasComponent } from './droplet-canvas.component';
import { MeasureComponent } from './measure.component';


@NgModule({
  declarations: [
    AppComponent,
    ChooseFileComponent,
    DropletCanvasComponent,
    MeasureComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserAnimationsModule,
    BrowserModule,
    FlexLayoutModule,
    FormsModule,
    HttpClientModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatTableModule,
  ],
  providers: [
    ChooseFileService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
