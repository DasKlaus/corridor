columnHeight = window.innerHeight-200; // -80 for the header, -20 for some space at the bottom, -100 for labels etc
columnWidth = 100;
cellDrawSpeed = 50; // ms for each cell placement
activeCell = "#000"; // standard color of cells
inactiveCell = "#aaa"; // color of cells outside placed limits
// TODO: make these configurable and responding to resize
// TODO: nest variables and functions into an object, so there's no accidental overloading when using this as a library

function init() {
	// button for adding columns
	columns = d3.select("#left").append("select").attr("onchange", "drawColumn(this);");
	columns.append("option").attr("value", "none").attr("disabled","disabled").append("tspan").html("draw column");
	columns.selectAll("columns").data(dataStructure).enter().append("option").attr("value", function(column, i) {
			return i;
		}).append("tspan").html(function(column) {
			return column.name;
		});
	columns.selectAll("option").filter(function(d) {
		return (undefined!=d && d.type=="id");
	}).attr("disabled","disabled"); // disable columns of type id (or maybe remove?)
	// tooltip div
	d3.select("body").append("div").attr("class", "tooltip");
}

function getCollidors(cellsInRow, x, radius) {
	return cellsInRow.filter(function() {
		if (Math.abs(d3.select(this).attr("cx")-x)<radius*2+1) return true; // colliding
		return false; // not colliding
	})[0].length;
}

// TODO: probably faster and prettier if placement is always at innermost non-colliding position instead of approximate placement first
function collide(cell, svg) {
	var radius = svg.attr("radius");
	// check collision, treat cells as squares for efficiency
	// get all cells at same height within radius 
	var cellsInRow = svg.selectAll(".cell").filter(function() {
		if(Math.abs(d3.select(this).attr("cy")-cell.attr("cy"))<radius*2+1) return true;
		return false;
	});
	if (getCollidors(cellsInRow, cell.attr("cx"), radius)>0) {
		// place cell at innermost position with no collisions
		var deviation = 0; // deviation from center of column
		var center = columnWidth/2; // center of column
		while (getCollidors(cellsInRow, center+deviation, radius)>0) {
			deviation = (deviation>0)?deviation*-1:(deviation*-1)+1; // alternate sides
		}
		cell.attr("cx", center+deviation);
	}
	// TODO: look if able to move to center?
}

function drawCell(data, svg) {
	var radius = svg.attr("radius"); // a radius of zero is still drawn as a pixel, but without a pixel distance in between
	var index = svg.attr("index");
	// check if scale is set and still correct
	checkScale(dataStructure[index], data[index], svg);
	var scale = dataStructure[index].scale;
	var row = 0;
	// row id is the first column of type id
	// TODO: if no id, return index of row
	for (var i=0;i<dataStructure.length;i++) {
		if (dataStructure[i].type=="id") row = data[i];
	}
	var cell = d3.select("svg[index='"+index+"'] .chart").append("circle")
		.attr("cy", function(d) {
			switch(dataStructure[index].type) {
				case "enum":
					var coords = scale(data[index]);
					var center = coords[0];
					var height = coords[1];
					// place cell randomly in a Gaussian distribution in the area
					return Math.round(makeGauss(center, height/6-2*radius, function(value){
						// prevent value from deviating outside of the placement area
						if (value>3 || value<-3) {
							value = value/10; // should do
						}
						return value;}));
					break;
				case "int":
				case "float":
				default:
					return Math.round(scale(data[index]));
			}
		})
		.attr("cx", function(d) {
			// approximate distribution of cells over x axis
			var y = this.getAttribute("cy");
			// get all cells that are already placed around the same y value
			var same = svg.selectAll(".cell").filter(function(d) {
					if (!d3.select(this).attr("value")) return false;
					return Math.abs(Math.round(d3.select(this).attr("cy")-y))<radius*2+1;
				});
			if ((same[0].length+1)*(radius*2+1)>=columnWidth) { // if the next point would have no room left, reduce radius
				if (radius>0) {
					radius--;
					svg.attr("radius", radius);
					// all cells already drawn need to be redrawn
					svg.selectAll(".cell").each(function() {
						var cell = d3.select(this);
						cell.attr("r", function(d){return (radius>0)?radius:1;}).attr("cx", function() {
							// calculate new x position
							var offset = ((cell.attr("cx")-columnWidth/2));
							var diff = offset/((radius+1)*2+1); // how many circles are we away from the center?
							return cell.attr("cx") - 2 * diff;
						});
					});
				}
				// TODO: if radius is already zero, reduce opacity
			}
			var side = (same[0].length%2)*2-1;
			return columnWidth/2 + (radius*2+1) * Math.ceil(same.size()/2) * side;
		})
		.attr("r", function(){return (radius>0)?radius:1;})
		.attr("class", "cell")
		.attr("value", data[index])
		.attr("cellid", row)
		.attr("column", index)		
		// save limitations by the limit sliders
		// TODO: limit is buggy on rescale
		.attr("limit", function(){
			// check if other rows have limits
			var cells = d3.selectAll(".cell[cellid='"+row+"']"); // all other cells with this id
			var limit = 0;
			cells.each(function() {if (d3.select(this).attr("limit")) limit += parseInt(d3.select(this).attr("limit"));});
			var limited = (limit>0);
			/*var limited = (d3.sum(d3.selectAll(".cell[cellid='"+row+"']")[0], function(d) {				
				return (d3.select(d).attr("limit"))?parseInt(d3.select(d).attr("limit")):0;})>0);*/
			if (limited) {
				// deactivate this cell
				d3.select(this).style("fill",inactiveCell);
			}
			var y = parseInt(d3.select(this).attr("cy"))+10; // add padding
			var top = parseInt(svg.select(".cutoff[dir='top']").attr("height"))+1; // top limit is off by one
			var bottom = svg.select(".cutoff[dir='bottom']").attr("y");
			if (y<top || y>bottom) {
				// deactivate all cells of this row
				d3.selectAll(".cell[cellid='"+row+"']").style("fill",inactiveCell);
				return 1;
			}
			return 0;
		})
		// on hover show tooltip and highlight all cells of this row
		// TODO: don't do this in css, because no color management in css.
		.on("mouseover", function() {
			// show tooltip
			var tooltipPositionMatrix = this.getScreenCTM().translate(+ this.getAttribute("cx"), + this.getAttribute("cy"));
			var tooltiptext = row+", "+data[index];
			if (dataStructure[index].unit) tooltiptext += " "+dataStructure[index].unit;
			d3.select(".tooltip").style("display","block")
				.style("top",(window.pageYOffset + tooltipPositionMatrix.f)+"px")
				.style("left",(window.pageXOffset + tooltipPositionMatrix.e)+"px")
				.text(tooltiptext);
			// highlight all cells of this row
			d3.selectAll(".cell[cellid='"+row+"']").attr("class", "cell hover").attr("r",5);
		})
		.on("mouseout", function() {
			// hide tooltip
			d3.select(".tooltip").style("display","none");
			// remove hover class and restore original radius
			d3.selectAll(".cell[cellid='"+row+"']").attr("class", "cell").attr("r", function(){
				var thisRadius = d3.select("svg[index='"+d3.select(this).attr("column")+"']").attr("radius");				
				return (thisRadius>0)?thisRadius:1;
			});
		});
	collide(cell, svg); // collision detection - refine placement if colliding
}

function drawColumn(select) {
	var index = select.value;
	select.value = "none"; // reset select
	var radius = 5; // starting radius
	if (d3.select(".column[index='"+index+"']").size()>0) return; // return if column already drawn
	// create svg
	var svg = d3.select("body").append("svg").attr("width",columnWidth+50).attr("height",columnHeight+100)
		.attr("class","column")
		.attr("index", index)
		.attr("radius", radius);
	// TODO: implement arrays - drawing more than one circle per dataset
	var chartArea = svg.append("g").attr("class","chart").attr("transform","translate(45, 10)")
	// draw border
	chartArea.append("path").attr("class", "border").attr("d", "M-5,0L"+(columnWidth+5)+" 0 L"+(columnWidth+5)+" "+columnHeight+" L-5,"+columnHeight);
	// draw labels (column name and, if set, unit)
	svg.append("text").style("text-anchor", "middle").style("font-weight", "bold")
		.attr("transform", "translate("+(columnWidth/2+50)+","+(columnHeight+50)+")")
		.text(dataStructure[index].name); // TODO: what if too wide?
	if (dataStructure[index].unit) {
		svg.append("text").style("text-anchor", "middle")
			.attr("transform", "translate("+(columnWidth/2+50)+","+(columnHeight+80)+")")
			.text("in "+dataStructure[index].unit);
	}
	// draw sliders
	slide = d3.behavior.drag()
	    .on("dragstart", function(){
		// TODO visual effects
	    })
	    .on("drag", function(){
		// TODO move slider (this) and resize corresponding rect
		// get cutoff and get other cutoff boundary
		if (d3.mouse(this.parentNode)[0]<0 || d3.mouse(this.parentNode)[0]>columnWidth+50) return; // mouse x coordinates out of bounds		
		var target = d3.mouse(this.parentNode)[1]; // mouse y coordinate relative to the svg
		// limit target y to actual chart area
		if (target < 10) target = 10;
		if (target > columnHeight+10) target = columnHeight+10;
		var dir = d3.select(this).attr("dir"); // find out if slider is top or bottom
		// get current boundary set by the opposite slider and limit target y accordingly
		var limit = (dir=="top")?
			d3.select(this.parentNode).select(".cutoff[dir='bottom']").attr("y"):
			d3.select(this.parentNode).select(".cutoff[dir='top']").attr("height"); // top limit is off by one
		if (dir=="top" && target>limit) target = limit-1;
		if (dir=="bottom" && target<parseInt(limit)+1) target = parseInt(limit)+2; // +2 because top limit is off by one (margin owed to firefox top pixel cutoff)
		// color cells
		d3.select(this.parentNode).selectAll(".cell").each(function() {
			var cellid = d3.select(this).attr("cellid");
			var y = parseInt(d3.select(this).attr("cy"))+10; // add top padding
			var limited = ((dir=="top" && y>target && y<limit) || (dir=="bottom" && y>limit && y<target))?0:1; // is inactive in this column
			d3.select(this).attr("limit",limited);
			var cells = d3.selectAll(".cell[cellid='"+cellid+"']"); // get all cells belonging to same row
			var otherLimits = 0;
			cells.each(function() {if (d3.select(this).attr("limit")) otherLimits += parseInt(d3.select(this).attr("limit"));});			
			var otherwiseLimited = (otherLimits>0); // counts all limits, not only by this column
			if (otherwiseLimited) {
				cells.style("fill", inactiveCell);
			}
			if (!otherwiseLimited) {
				cells.style("fill", activeCell);
			}
		});
		// move slider and resize corresponding cutoff rectangle
		d3.select(this).attr("y", function(){
			return (dir=="top")?target-5:target;
		});
		var svg = d3.select(this.parentNode);
		var cutoff = svg.select(".cutoff[dir='"+dir+"']");
			cutoff.attr("height", function(){
					return (dir=="top")?target-1:columnHeight+20-target;
				});
			cutoff.attr("y", function(){
					return (dir=="top")?1:target;
				});

		// TODO: while cell painting, check if within these limits and define color accordingly
		// TODO: snap to boundaries
		// TODO: if enum, only ever snap to boundaries

		// test
		// d3.select(".tooltip").style("display","block").text("old: "+old+", target: "+target+", dir: "+dir+", limit: "+limit);
		
	    })
	    .on("dragend", function(){
		// TODO visual effects
	    });
	// TODO visual hover effects
	svg.append("rect").attr("class","cutoff").attr("dir","top").attr("x",40).attr("y",1).attr("width",columnWidth+10).attr("height",9); // margin top because first pixel cuts off in firefox
	svg.append("rect").attr("class","slider").attr("dir","top").attr("x",40).attr("y",5).attr("width",columnWidth+10).attr("height",5).call(slide);
	svg.append("rect").attr("class","cutoff").attr("dir","bottom").attr("x",40).attr("y",columnHeight+10).attr("width",columnWidth+10).attr("height",9);
	svg.append("rect").attr("class","slider").attr("dir","bottom").attr("x",40).attr("y",columnHeight+10).attr("width",columnWidth+10).attr("height",5).call(slide);
	// draw data
	var row = 0;
	// set a new timer
	// TODO: requestAnimationFrame
	var timer = setInterval(function() {
		if (data[row][index] !== undefined && data[row][index] !== null) { // don't draw if value is null or undefined
			drawCell(data[row], svg)
		}
		row++;
		if (row >= data.length) {window.clearInterval(timer);} // selfdestruct on end of data
	}, cellDrawSpeed);
}

function drawAxis(structure, svg) {
	// remove if already drawn
	svg.select(".axis").remove();
	switch(structure.type) {
		case "enum": 
			// make the container and line
			var axis = svg.append("g").attr("transform", "translate(40,10)").attr("class","axis")
			axis.append("path").attr("class", "domain").attr("d", "M-6,0H0V"+columnHeight+"H-6");
			// label the middle of the value area
			for (var i=0; i<structure.values.length; i++) {
				var text = structure.values[i].value+" ("+Math.round(structure.values[i].percent)+"%)";
				var ypos = structure.scale(structure.values[i].value)[0];
				axis.append("g").attr("transform", "translate(-9,"+ypos+")")
					.append("text").style("text-anchor", "middle").attr("transform", "rotate(-90)").text(text);
			}
			// draw boundaries
			if (structure.boundaries) {
				for (var i=0; i<structure.boundaries.length; i++) {
					axis.append("path").attr("class","boundary").attr("d","M0,"+structure.boundaries[i]+"H150").attr("stroke-width", 1).attr("stroke-dasharray","1,2");
				}
			}
			break;
		case "int":
		case "float":
		default: var axis = d3.svg.axis()
			    .scale(structure.scale)
			    .orient("left")
			    .ticks(20);
			svg.append("g").attr("transform", "translate(40,10)").attr("class","axis").call(axis); // TODO: what if labels are wider than 40px? big numbers? strings?
	}
}

function checkScale(structure, data, svg) {
	if (!structure.scale) { // if no scale is set, create a new one and draw its axis
		switch(structure.type) {
			case "enum": structure.total = 1; // absolute number of datasets drawn
				structure.percent = 100.0; // added percentages, always 100 if not an array of enums
				structure.values = new Array({value: data, total: 1, percent: 100, offset: 0}); // only one value yet known
				structure.boundaries = new Array(); // only one value, so no boundaries
				// make helper scale for pixel calculation from percent values
				structure.topixel = d3.scale.linear().domain([0,structure.percent]).range([columnHeight,0]);
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
			case "int":
			case "float":
			default: structure.min = data;
				structure.max = data; 
				structure.scale = d3.scale.linear().domain([data-1, data+1]).range([columnHeight,0]);
		}
		drawAxis(structure, svg);
		return;
	}
	// check if scale is still correct
	switch(structure.type) {
		case "enum": 
			// add cell to total
			structure.total++;
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
			// recalculate percentages
			for (var i=0; i<structure.values.length; i++) {
				structure.values[i].percent = structure.values[i].total/structure.total*100;
			}
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
				offset = structure.values[i].percent;
			}
			drawAxis(structure, svg); // redraw axis
			// all cells drawn up to this point need to be repositioned
			svg.selectAll(".cell").each(function() {
				var cell = d3.select(this);
				// check if out of bounds
				var coords = structure.scale(cell.attr("value"));
				var center = coords[0];
				var height = coords[1];
				if (cell.attr("cy")<center-height/2+cell.attr("r") || cell.attr("cy")>center+height/2-cell.attr("r"))
				{
					// reposition
					cell.attr("cy", function() {
						return Math.round(makeGauss(center, height/4-2*cell.attr("r"), function(value){
							// prevent value from deviating outside of the placement area
							if (value>2 || value<-2) {
								value = value/10; // should do
							}
							return value;}));
					});
				}
			});
			break;
		case "int":
		case "float":
		default: if (data>structure.min && data<structure.max) return; // no change in scale
			if (data <= structure.min) { // set a new minimum at 5% of domain below actual minimum
				// if minimum value is close to zero, start the scale at zero
				structure.min = (data>0 && data<(structure.max-data) * 0.15)?0:data-(structure.max-data)*0.05; // TODO: round to something nice
			}
			if (data >= structure.max) { // set a new maximum at 5% of domain above actual maximum
				structure.max = data+(data-structure.min)*0.05; // TODO: round to something nice
			}
			structure.scale.domain([structure.min, structure.max]);
			drawAxis(structure, svg); // redraw axis
			// all cells drawn up to this point need to be repositioned
			svg.selectAll(".cell").each(function() {
				var cell = d3.select(this);
				cell.attr("cy", Math.round(dataStructure[cell.attr("column")].scale(cell.attr("value"))));
				collide(cell, svg);
			});
	}	
}

// TODO: enum scale should group data below a certain height to "other"
// TODO: dynamic number of datasets
// TODO: optional adding group boundaries to floats and ints, or gradients, or colors
// TODO: dynamic output of grouped data for chart drawing (probably) (later)

init();
