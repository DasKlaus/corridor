/*
   It should stand alone when used in other projects.
   Calling init with data and structure
*/

// TODO: select a column and configure dataStructure
/* Initialization of the main object 
   it holds the default values for all configurable 
*/
corridor = {
	columnHeight: window.innerHeight -200, // -80 for the header, -20 for some space at the bottom, -100 for labels
	columnWidth: 100,
	cellDrawSpeed: 50, // ms for each cell placement
	activeCell: "#000", // standard color of cells
	inactiveCell: "#ddd", // color of cells outside placed limits
	hoverCell: "#f30", // color of cells on mouseover
	data: new Array(),
	structure: new Array(),
	controllerId: "controller", // id of html object for form elements
	busy: false // flag for interrupting timer if scales are recalculated etc
};

// TODO: nest variables and functions into an object, so there's no accidental overloading when using this as a library

function getStructure() {
	// TODO: enter structure for data
	// TODO: when finished, call init again with data and structure
	// TODO: in HTML make checkbox if data generation should provide structure or not
	init(corridor.data, structure);
}

// TODO: init should be called corridor and return the object, so it could be used like corridor().blablubb etc
function init(data, structure) {
	corridor.data = data;
	if (structure) {
		corridor.structure = structure;
	} else {
		getStructure();
		return;
	}
	// tooltip div
	d3.select("body").append("div").attr("class", "tooltip");
	makeButtons();
}

function makeButtons(column) {
	var controller = d3.select("#"+corridor.controllerId);
	// remove all children of controller
	controller.selectAll("*").remove();
	if (column===undefined) {
		controller.attr("column", "none"); // save information about current content of controller
		// help text
		controller.append("span").attr("class", "help").html("Now that you have data, you can draw it. <br><br>"
			+ "Your data has several columns to choose from, but you can also draw all of them at once. <br>"
			+ "One of them is called 'id' - you cannot draw it because it does not represent information and serves only as an identifier. "
			+ "If you hover over a cell in the visualisation, you can see its id as well as the highlighted value.<br><br>"
			+ "You can specify the speed at which cells are positioned. Just enter a time in milliseconds each cell should take to be drawn here:<br>");
		// button for draw speed
		controller.append("input").attr("type","text").attr("name","cellDrawSpeed").attr("value",corridor.cellDrawSpeed)
			.attr("onchange","corridor.cellDrawSpeed = isNaN(parseInt(this.value))?corridor.cellDrawSpeed:parseInt(this.value);");
		// button for adding columns
		columns = controller.append("select").attr("onchange", "drawColumn(this);");
		columns.append("option").attr("value", "none").attr("disabled","disabled").append("tspan").html("draw column");
		columns.append("option").attr("value", "all").append("tspan").html("all");
		columns.selectAll("columns").data(corridor.structure).enter().append("option").attr("value", function(column, i) {
				return i;
			}).append("tspan").html(function(column) {
				return column.name;
			});
		columns.selectAll("option").filter(function(d) {
			return (undefined!=d && d.type=="id");
		}).attr("disabled","disabled"); // disable columns of type id
		// help text
		controller.append("span").attr("class", "help").html("<br><br>Try clicking on the name of a column you have drawn "
			+ "or moving the grey bars at the top and bottom of the chart via drag and drop.");
		return;
	}
	controller.attr("column", column); // save information about current content of controller
	var structure = corridor.structure[column];
	// help text
	controller.append("span").attr("class", "help").html("The data in this column has "+structure.type+" values.<br><br>Change the name of this column here:");
	// name input
	controller.append("input").attr("type","text").attr("name","columnname").attr("value",structure.name)
		.attr("onchange","corridor.structure["+column+"].name=this.value; drawLabels(d3.select("+'"'+"svg[column='"+column+"']"+'"'+"), "+column+")");
	switch (structure.type) {
		case "enum": break; // no more configuration possible for enums
		case "number": // unit, min, max, boundaries
			// unit
			controller.append("span").attr("class", "help").html("<br><br>Change the unit of values in this column here:");
			controller.append("input").attr("type","text").attr("name","columnunit").attr("value",structure.unit)
				.attr("onchange","corridor.structure["+column+"].unit=this.value; drawLabels(d3.select("+'"'+"svg[column='"+column+"']"+'"'+"), "+column+")");
			// min and max
			controller.append("span").attr("class", "help").html("<br><br>Change the displayed minimum and maximum of the y-axis scale here "
				+ "(this will not change the values themselves, just their position on the scale).<br><br>Minimum:");
			controller.append("input").attr("type","text").attr("name","columnmin").attr("value",structure.min)
				.attr("onchange","corridor.structure["+column+"].min=isNaN(parseInt(this.value))?corridor.structure["+column+"].min:parseInt(this.value); changeScale(d3.select("+'"'+"svg[column='"+column+"']"+'"'+"), corridor.structure["+column+"])");
			controller.append("span").attr("class", "help").html("<br>Maximum:");
			controller.append("input").attr("type","text").attr("name","columnmax").attr("value",structure.max)
				.attr("onchange","corridor.structure["+column+"].max=isNaN(parseInt(this.value))?corridor.structure["+column+"].max:parseInt(this.value); changeScale(d3.select("+'"'+"svg[column='"+column+"']"+'"'+"), corridor.structure["+column+"])");
			
	
	}
}

function drawColumn(select) {
	var column = select.value;
	if (column == "all") { // draw all columns
		for (var i=0; i<corridor.structure.length; i++) {
			if (corridor.structure[i].type != "id") {
				select.value = i;
				drawColumn(select);
			}
		}
		return;
	}
	corridor.structure[column].none = 0; // initialize counter of rows without values	
	select.value = "none"; // reset select
	var radius = 5; // starting radius
	if (d3.select(".column[column='"+column+"']").size()>0) return; // return if column already drawn
	// create svg
	var svg = d3.select("body").append("svg").attr("width",corridor.columnWidth+50).attr("height",corridor.columnHeight+100)
		.attr("class","column")
		.attr("column", column)
		.attr("radius", radius);
	var chartArea = svg.append("g").attr("class","chart").attr("transform","translate(45, 10)")
	// draw border
	chartArea.append("path").attr("class", "border").attr("d", "M-5,0L"+(corridor.columnWidth+4)+" 0 L"+(corridor.columnWidth+4)+" "+corridor.columnHeight+" L-5,"+corridor.columnHeight);
	drawLabels(svg, column);
	// empty text element for later output of rows without values
	svg.append("text").style("text-anchor", "middle")
		.attr("transform", "translate("+(corridor.columnWidth/2+50)+","+(corridor.columnHeight+80)+")")
		.attr("class", "empty").text("");
	// draw sliders
	sliding = d3.behavior.drag()
	    .on("dragstart", function(){
		d3.select(this).attr("class", "slider dragging");
		corridor.busy = true;
	    })
	    .on("drag", function(){
		var svg = d3.select(this.parentNode);
		// get cutoff and get other cutoff boundary
		if (d3.mouse(this.parentNode)[0]<0 || d3.mouse(this.parentNode)[0]>corridor.columnWidth+50) return; // mouse x coordinates out of bounds		
		var target = d3.mouse(this.parentNode)[1]; // mouse y coordinate relative to the svg
		var dir = d3.select(this).attr("dir"); // find out if slider is top or bottom
		slide(svg, dir, target);
	    })
	    .on("dragend", function(){
		d3.select(this).attr("class", "slider");
		corridor.busy = false;
	    });
	svg.append("rect").attr("class","cutoff").attr("dir","top").attr("x",40).attr("y",1).attr("width",corridor.columnWidth+9).attr("height",9); // margin top because first pixel cuts off in firefox
	svg.append("rect").attr("class","slider").attr("dir","top").attr("x",41).attr("y",5).attr("width",corridor.columnWidth+7).attr("height",5).call(sliding);
	svg.append("rect").attr("class","cutoff").attr("dir","bottom").attr("x",40).attr("y",corridor.columnHeight+10).attr("width",corridor.columnWidth+9).attr("height",9);
	svg.append("rect").attr("class","slider").attr("dir","bottom").attr("x",41).attr("y",corridor.columnHeight+10).attr("width",corridor.columnWidth+7).attr("height",5).call(sliding);
	// draw data
	var row = 0;
	var arrayindex = 0; // for data in arrays
	// set a new timer
	// TODO: use requestAnimationFrame instead of setInterval
	var timer = setInterval(function() {
		if (!corridor.busy) { // check for busy scripts
			var data = corridor.data[row][column];
			// if data is an array, get data from current position in that array
			if (Array.isArray(data)) {
				// if array is empty, set data to null
				data = (arrayindex < data.length)?data[arrayindex]:null;
			}
			if (data !== undefined && data !== null) { // don't draw if value is null or undefined
				drawCell(data, svg, row, column);
			} else {
				// count empty data for accurate percentages
				corridor.structure[column].none++;
				// TODO: check scale for accurate percentages of enums
				// output
				svg.select(".empty").text("no value: "+corridor.structure[column].none+" ("+Math.round(corridor.structure[column].none/(row+1)*100)+"%)");
			}
			// update counters
			if (Array.isArray(corridor.data[row][column])) {
				if (arrayindex < corridor.data[row][column].length) {
					arrayindex++;
				}
				else { // end of array or empty array
					if (arrayindex>0) {
						arrayindex = 0;
						corridor.structure[column].none--; // to prevent counting of arrays that reached their end
					}
					row++;
				}
			} else {
				arrayindex = 0;
				row++;
			}
			if (row >= corridor.data.length) {window.clearInterval(timer);} // selfdestruct on end of data
		}
	}, corridor.cellDrawSpeed);
}

function drawLabels(svg, column) {
	svg.select(".name").remove();
	// draw labels (column name and, if set, unit)
	svg.append("text").attr("class","name").style("text-anchor", "middle").style("font-weight", "bold")
		.attr("transform", "translate("+(corridor.columnWidth/2+50)+","+(corridor.columnHeight+50)+")")
		.on("click", function(){
			if (d3.select("#"+corridor.controllerId).attr("column")!=column) makeButtons(column);
			else makeButtons(); // reset controller content if this column is already selected
		})
		.text(corridor.structure[column].name); // TODO: what if too wide?
	if (corridor.structure[column].unit) {
		svg.select(".unit").remove();
		svg.append("text").attr("class","unit").style("text-anchor", "middle")
			.attr("transform", "translate("+(corridor.columnWidth/2+50)+","+(corridor.columnHeight+80)+")")
			.text("in "+corridor.structure[column].unit);
	}
}

function drawCell(data, svg, row, column) {
	var radius = svg.attr("radius"); // a radius of zero is still drawn as a pixel, but without a pixel distance in between
	// check if scale is set and still correct
	checkScale(corridor.structure[column], data, svg, row);
	var scale = corridor.structure[column].scale;
	var cell = d3.select("svg[column='"+column+"'] .chart").append("circle")
		.attr("r", function(){return (radius>0)?radius:1;})
		.attr("class", "cell")
		.attr("value", data)
		.attr("cellid", row)
		.attr("column", column)		
		.attr("cy", function() {
			switch(corridor.structure[column].type) {
				case "enum":
					// place cell randomly in a Gaussian distribution in the area
					return enumposition(scale(data)[0], scale(data)[1], radius);
					break;
				case "number":
					// place cell at exact value
					return Math.round(scale(data));
			}
		})
		.attr("cx", function() {
			return collide(d3.select(this),svg);
		})
		// save limitations by the limit sliders as binary
		.attr("limit", function(){
			// check if other rows have limits
			var cells = d3.selectAll(".cell[cellid='"+row+"']"); // all other cells with this id
			var limit = 0;
			cells.each(function() {if (d3.select(this).attr("limit")) limit += parseInt(d3.select(this).attr("limit"));});
			var limited = (limit>0);
			if (limited) {
				// deactivate this cell
				d3.select(this).style("fill",corridor.inactiveCell);
			}
			// check if this cell is limited by a slider on this column			
			var y = parseInt(d3.select(this).attr("cy"))+10; // add padding
			var top = parseInt(svg.select(".cutoff[dir='top']").attr("height"))+1; // top limit is off by one
			var bottom = svg.select(".cutoff[dir='bottom']").attr("y");
			if (y<top || y>bottom) {
				// deactivate all cells of this row
				d3.selectAll(".cell[cellid='"+row+"']").style("fill",corridor.inactiveCell);
				return 1;
			}
			return 0;
		})
		// on hover show tooltip and highlight all cells of this row
		.on("mouseover", function() {
			// show tooltip
			var tooltipPositionMatrix = this.getScreenCTM().translate(+ this.getAttribute("cx"), + this.getAttribute("cy"));
			var tooltiptext = row+", "+data;
			if (corridor.structure[column].unit) tooltiptext += " "+corridor.structure[column].unit;
			d3.select(".tooltip").style("display","block")
				.style("top",(window.pageYOffset + tooltipPositionMatrix.f)+"px")
				.style("left",(window.pageXOffset + tooltipPositionMatrix.e)+"px")
				.text(tooltiptext);
			// highlight all cells of this row
			d3.selectAll(".cell[cellid='"+row+"']").style("fill",corridor.hoverCell).attr("r",5);
		})
		.on("mouseout", function() {
			// hide tooltip
			d3.select(".tooltip").style("display","none");
			// remove hover class and restore original radius
			var cells = d3.selectAll(".cell[cellid='"+row+"']");
			cells.attr("r", function(){
				var thisRadius = d3.select("svg[column='"+d3.select(this).attr("column")+"']").attr("radius");				
				return (thisRadius>0)?thisRadius:1;
			});
			// find out if this cell is limited to determine color
			var limit = 0;
			cells.each(function() {if (d3.select(this).attr("limit")) limit += parseInt(d3.select(this).attr("limit"));});
			var limited = (limit>0);
			cells.style("fill", function() {
				return (limited)?corridor.inactiveCell:corridor.activeCell;
			});
		});
	collide(cell, svg); // collision detection - refine placement if colliding
}

function drawAxis(structure, svg) {
	// remove if already drawn
	svg.select(".axis").remove();
	switch(structure.type) {
		case "enum": 
			// make the container and line
			var axis = svg.append("g").attr("transform", "translate(40,10)").attr("class","axis")
			axis.append("path").attr("class", "domain").attr("d", "M-6,0H0V"+corridor.columnHeight+"H-6");
			// label the middle of the value area
			for (var i=0; i<structure.values.length; i++) {
				var ypos = structure.scale(structure.values[i].value)[0];
				var label = axis.append("g").attr("transform", "translate(-26,"+ypos+")");
				label.append("text").attr("class", "label").style("text-anchor", "middle").attr("transform", "rotate(-90)").text(structure.values[i].value);
				label.append("text").attr("class", "label").style("text-anchor", "middle").attr("transform", "rotate(-90) translate(0,18)")
					.text(structure.values[i].total+" ("+Math.round(structure.values[i].percent)+"%)");
				// TODO: if label is larger, make numbers smaller, cut off text, on hover write it out large
			}
			// draw boundaries
			if (structure.boundaries) {
				for (var i=0; i<structure.boundaries.length; i++) {
					axis.append("path").attr("class","boundary").attr("d","M0,"+structure.boundaries[i]+"H150").attr("stroke-width", 1).attr("stroke-dasharray","1,2");
				}
			}
			break;
		case "number": // use standard d3 axis
			var axis = d3.svg.axis()
			    .scale(structure.scale)
			    .orient("left")
			    .ticks(20);
			svg.append("g").attr("transform", "translate(40,10)").attr("class","axis").call(axis); // TODO: dynamic width depending on label length
	}
}

function checkScale(structure, data, svg, row) {
	// if no scale is set, create a new one and draw its axis
	if (!structure.scale) {
		switch(structure.type) {
			case "enum": structure.total = row+1; // absolute number of datasets drawn
				if (!structure.none) structure.none = 0;
				structure.percent = 1/structure.total*100; // added percentages, always 100 if not an array of enums
				structure.values = new Array({value: data, total: 1, percent: 1/structure.total*100, offset: 0}); // only one value yet known
				structure.boundaries = new Array(); // only one value, so no boundaries yet
				// make helper scale for pixel calculation from percent values
				structure.topixel = d3.scale.linear().domain([0,structure.percent]).range([corridor.columnHeight,0]);
				// scale is a custom function that returns the center of the block for this specific string and its height in pixels for cell placement
				structure.scale = function(value) {
					// search for value in structure.values
					for (var i=0; i<structure.values.length; i++) {
						if (structure.values[i].value == value) {
							// get offset and height
							var offset = structure.topixel(structure.values[i].offset); // lowest point
							var height = structure.topixel(structure.percent-structure.values[i].percent);
							// return middle of the placeable area and height
							return new Array(Math.round(offset-height/2), Math.round(height));
						}
					}
				};
				break;
			case "number": // use standard d3 scale
				structure.min = data;
				structure.max = data; 
				structure.scale = d3.scale.linear().domain([data-1, data+1]).range([corridor.columnHeight,0]);
		}
		drawAxis(structure, svg);
		return;
	}
	// check if scale is still correct
	switch(structure.type) {
		case "enum": 
			// set index of dataset as total to account for arrays
			structure.total = row+1;
			// look for value in values
			var valueData;
			for (var i=0; i<structure.values.length; i++) {
				if (structure.values[i].value == data) 
					valueData = structure.values[i];
			}
			if (valueData) { // value already exists
				// add counters
				valueData.total++;
				// check percentages
				if (Math.abs(valueData.percent - valueData.total/structure.total*100)<1)
					return; // no change in scale
			} else {
				// add data for new value
				valueData = {value: data, total: 1, percent: 0, offset: 0}; // percentages and offsets will be recalculated, anyway
				structure.values.push(valueData);
			}
			changeScale(svg, structure);
			break;
		case "number": if (data>structure.min && data<structure.max) return; // no change in scale
			if (data <= structure.min) { // set a new minimum at 5% of domain below actual minimum
				// if minimum value is close to zero, start the scale at zero
				structure.min = (data>0 && data<(structure.max-data) * 0.25)?0:roundNice(data-(structure.max-data)*0.15, structure.max-data); // round to something nice
			}
			if (data >= structure.max) { // set a new maximum at 5% of domain above actual maximum
				structure.max = roundNice(data+(data-structure.min)*0.15, data-structure.min); // round to something nice
			}
			// update inputs, if displayed
			if (d3.select("#"+corridor.controllerId).attr("column")==svg.attr("column")) {
				d3.select("input[name='columnmin']").attr("value", structure.min);
				d3.select("input[name='columnmax']").attr("value", structure.max);
			}
			changeScale(svg, structure);
	}	
}

function changeScale(svg, structure) {
	switch (structure.type) {
		case "enum": 
			corridor.busy = true;
			// recalculate percentages
			var total = 0; // total percentages
			for (var i=0; i<structure.values.length; i++) {
				structure.values[i].percent = structure.values[i].total/structure.total*100;
				total += structure.values[i].percent;
			}
			structure.percent = total;
			structure.topixel.domain([0,total]);
			// resort by percentages (largest first)
			structure.values.sort(function(a, b) {
				var x = a.percent; 
				var y = b.percent;
				return ((x > y) ? -1 : ((x < y) ? 1 : 0));
			});
			// recalculate offsets and boundaries
			structure.boundaries = new Array();
			var offset = 0;
			for (var i=0; i<structure.values.length; i++) {
				structure.values[i].offset = offset;
				if (offset>0) {
					// add boundary
					structure.boundaries.push(Math.round(structure.topixel(offset)));
				}
				offset += structure.values[i].percent;
			}
			drawAxis(structure, svg); // redraw axis
			// select cells that need to be redrawn
			var cells = svg.selectAll(".cell").filter(function() {
				var cell = d3.select(this);
				var coords = structure.scale(cell.attr("value"));
				var center = coords[0];
				var height = coords[1];
				// check if out of bounds
				if (cell.attr("cy")<center-height/2+parseInt(cell.attr("r")) || cell.attr("cy")>center+height/2-cell.attr("r"))
					return true;
				return false;
			});
			cells.attr("cx", corridor.columnWidth+50) // set x out of bounds
				.attr("cy", function(){
					var cell = d3.select(this);
					var coords = structure.scale(cell.attr("value"));
					var center = coords[0];
					var height = coords[1];
					return enumposition(center, height, cell.attr("r"));
				});
			cells.attr("cx", function(){return collide(d3.select(this),svg);});
			// snap slider to nearest boundary
			var top = parseInt(svg.select(".cutoff[dir='top']").attr("height"))+1; // top limit is off by one
			var bottom = svg.select(".cutoff[dir='bottom']").attr("y");
			if (top-10>0) {
				slide(svg, "top", nearestBoundary(structure, top)+10, nearestBoundary(structure, bottom)+10);
			}
			if (bottom-10<corridor.columnHeight) {
				slide(svg, "bottom", nearestBoundary(structure, bottom)+10, nearestBoundary(structure, top)+10);
			}
			corridor.busy = false;
			break;
		case "number": 
			corridor.busy = true;
			var oldmin = structure.scale.domain()[0];
			var oldmax = structure.scale.domain()[1];
			// check if limits are set
			var top = parseInt(svg.select(".cutoff[dir='top']").attr("height"))+1; // top limit is off by one
			var bottom = svg.select(".cutoff[dir='bottom']").attr("y");
			var limits = {top: oldmax, bottom: oldmin};
			// get value of top limit
			if (top-10>0) {
				var reverseScale = d3.scale.linear().domain([corridor.columnHeight, 0]).range([oldmin, oldmax]);
				limits.top = reverseScale(top-10);
			}
			if (bottom-10<corridor.columnHeight) {
				var reverseScale = d3.scale.linear().domain([corridor.columnHeight, 0]).range([oldmin, oldmax]);
				limits.bottom = reverseScale(bottom-10);
			}
			structure.scale.domain([structure.min, structure.max]);
			drawAxis(structure, svg); // redraw axis
			// all cells drawn up to this point need to be repositioned
			var cutoff = false; // flag for cells out of bounds - if true, limits need to be recalculated
			svg.selectAll(".cell").attr("cy", function() {
				result = Math.round(corridor.structure[svg.attr("column")].scale(d3.select(this).attr("value")));
				// check if cell is out of bounds
				if (result>corridor.columnHeight || result<0) {
					d3.select(this).style("display", "none");
					cutoff = true;
				}
				else d3.select(this).style("display", "unset"); // make sure it's displayed otherwise
				return Math.round(corridor.structure[svg.attr("column")].scale(d3.select(this).attr("value")));
			}).attr("cx", corridor.columnWidth+parseInt(svg.attr("radius"))); // set x out of bounds
			// recalculate new x
			svg.selectAll(".cell").attr("cx", function() {
				return collide(d3.select(this), svg);
			});
			// now that the new scale is set, limits need to be repositioned, if set
			if (top-10>0 || cutoff) {
				slide(svg, "top", structure.scale(limits.top)+10, structure.scale(limits.bottom)+10);
			}
			if (bottom-10<corridor.columnHeight || cutoff) {
				slide(svg, "bottom", structure.scale(limits.bottom)+10, structure.scale(limits.top)+10);
			}
			corridor.busy = false;
	}
}

function reduceRadius(radius, svg) {
	corridor.busy = true;
	if (radius>0) {
		radius--;
		svg.attr("radius", radius);
		// all cells already drawn need to be redrawn
		svg.selectAll(".cell").attr("r", function() {return (radius>0)?radius:1;})
			.attr("cx", corridor.columnWidth+radius); // set x out bounds 
		// recalculate new x
		svg.selectAll(".cell").attr("cx", function() {
			return collide(d3.select(this), svg);
		});
	}
	corridor.busy = false;
	// TODO: if radius is already zero, reduce opacity (needs to change formula triggering reduction, too)
}

function collide(cell, svg) {
	var radius = svg.attr("radius");
	// check collision, treat cells as squares for efficiency
	// get all cells at same height within radius 
	var cellsInRow = svg.selectAll(".cell").filter(function() {
		if(Math.abs(d3.select(this).attr("cy")-cell.attr("cy"))<radius*2+1) return true;
		return false;
	});
	// place cell at innermost position with no collisions
	var deviation = 0; // deviation from center of column
	var center = corridor.columnWidth/2; // center of column
	while (getCollidors(cellsInRow, center+deviation, radius)>0) {
		deviation = (deviation>0)?deviation*-1:(deviation*-1)+1; // alternate sides
	}
	// if not enough space to place cell, reduce radius
	if (Math.abs(deviation)>corridor.columnWidth/2-2*radius) {
		reduceRadius(radius, svg);
		// do it again, because now all x values have been reset.
		return collide(cell, svg);
	}
	return (center+deviation);
}

function getCollidors(cellsInRow, x, radius) {
	return cellsInRow.filter(function() {
		if (Math.abs(d3.select(this).attr("cx")-x)<radius*2+1) return true; // colliding
		return false; // not colliding
	})[0].length;
}

function enumposition(center, height, radius) {
	return Math.round(makeGauss(center, height/6-2*radius, function(value){
		// prevent value from deviating outside of the placement area
		if (value>3 || value<-3) {
			value = value/10; // should do
		}
		return value;}));
}

function nearestBoundary(structure, target) {
	var boundaries = structure.boundaries;
	// include top and bottom of column
	boundaries.push(corridor.columnHeight);
	boundaries.push(0);
	var boundary = 0; // nearest boundary
	for (var i=0; i<boundaries.length; i++) {
		if (Math.abs(parseInt(target)+10-boundaries[i])<Math.abs(parseInt(target)+10-boundary))
			boundary = boundaries[i];
	}
	return boundary;
}
				
function slide(svg, dir, target) {
	var slider = svg.select(".slider[dir='"+dir+"']");
	var cutoff = svg.select(".cutoff[dir='"+dir+"']");
	switch (corridor.structure[svg.attr("column")].type) {
		// snap to nearest boundary			
		case "enum":
			var boundary = nearestBoundary(corridor.structure[column], target);
			target = boundary +10;
			break;
		case "number": 
	}
	// limit target y to actual chart area
	if (target < 10) target = 10;
	if (target > corridor.columnHeight+10) target = corridor.columnHeight+10;
	// get current boundary set by the opposite slider and limit target y accordingly
	var limit = (dir=="top")?
		svg.select(".cutoff[dir='bottom']").attr("y"):
		svg.select(".cutoff[dir='top']").attr("height"); // top limit is off by one
	if (dir=="top" && target>limit) target = limit-1;
	if (dir=="bottom" && target<parseInt(limit)+1) target = parseInt(limit)+2; // +2 because top limit is off by one (margin owed to firefox top pixel cutoff)
	// color cells
	svg.selectAll(".cell").each(function() {
		var cellid = d3.select(this).attr("cellid");
		var y = parseInt(d3.select(this).attr("cy"))+10; // add top padding
		var limited = ((dir=="top" && y>target && y<limit) || (dir=="bottom" && y>limit && y<target))?0:1; // is inactive in this column
		d3.select(this).attr("limit",limited);
		var cells = d3.selectAll(".cell[cellid='"+cellid+"']"); // get all cells belonging to same row
		var otherLimits = 0;
		cells.each(function() {if (d3.select(this).attr("limit")) otherLimits += parseInt(d3.select(this).attr("limit"));});			
		var otherwiseLimited = (otherLimits>0); // counts all limits, not only by this column
		if (otherwiseLimited) {
			cells.style("fill", corridor.inactiveCell);
		}
		if (!otherwiseLimited) {
			cells.style("fill", corridor.activeCell);
		}
	});
	// move slider and resize corresponding cutoff rectangle
	slider.attr("y", function(){
		return (dir=="top")?target-5:target;
	});
	cutoff.attr("height", function(){
		return (dir=="top")?target-1:corridor.columnHeight+20-target;
	});
	cutoff.attr("y", function(){
		return (dir=="top")?1:target;
	});
}

function roundNice(value, domain) {
	// maximum rounding error is 10% of domain
	var limit = domain*0.1;
	var precision = 1;
	while(Math.abs(value-value.toPrecision(precision))>limit) {
		precision++;
	}
	var structure = corridor.structure;
	var result = Number(value.toPrecision(precision));
	return result;
}
