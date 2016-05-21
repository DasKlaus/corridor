columnHeight = $(window).height()-100;
columnWidth = 150;
cellDrawSpeed = 100; // ms for each cell placement
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
	d3.select("svg[index='"+index+"'] .chart").append("circle")
		.attr("cy", function(d) {
			switch(dataStructure[index].type) {
				case "enum":
					var coords = scale(data[index]);
					var center = coords[0];
					var height = coords[1];
					// place cell randomly in a Gaussian distribution in the area
					return Math.round(makeGauss(center, height/4-2*radius, function(value){
						// prevent value from deviating outside of the placement area
						if (value>2 || value<-2) {
							value = makeGauss(0, 1); // TODO: nope!
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
			// TODO: refine placement on requestAnimationFrame (collision detection)
			var y = this.getAttribute("cy");
			// get all cells that are already placed around the same y value
			var same = svg.selectAll(".cell").filter(function(d) {
					if (!d3.select(this).attr("value")) return false;
					return Math.abs(Math.round(scale(d3.select(this).attr("value"))-y))<radius*2+1;
				});
			if ((same[0].length+1)*(radius*2+1)>=columnWidth-50) { // if the next point would have no room left, reduce radius
				if (radius>0) {
					radius--;
					svg.attr("radius", radius);
					// all cells already drawn need to be redrawn
					svg.selectAll(".cell").each(function() {
						// TODO: transitions?
						var cell = d3.select(this);
						cell.attr("r", function(d){return (radius>0)?radius:1;}).attr("cx", function() {
							// calculate new x position
							var offset = ((cell.attr("cx")-(columnWidth-50)/2));
							var diff = offset/((radius+1)*2+1); // how many circles are we away from the center?
							return cell.attr("cx") - 2 * diff;
						});
					});
				}
			}
			var side = (same[0].length%2)*2-1;
			return (columnWidth-50)/2 + (radius*2+1) * Math.ceil(same.size()/2) * side; // TODO: except if too wide! What then? make smaller circles bzw. less alpha
		})
		.attr("r", function(d){return (radius>0)?radius:1;})
		.attr("class", "cell")
		.attr("value", data[index])
		.attr("cellid", row)
		.attr("column", index)
		// on hover show tooltip and highlight all cells of this row
		// TODO: don't do this in css, because no color management in css.
		.on("mouseover", function(d) {
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
		.on("mouseout", function(d) {
			// hide tooltip
			d3.select(".tooltip").style("display","none");
			// remove hover class and restore original radius
			d3.selectAll(".cell[cellid='"+row+"']").attr("class", "cell").attr("r", function(d){
				var thisRadius = d3.select("svg[index='"+d3.select(this).attr("column")+"']").attr("radius");				
				return (thisRadius>0)?thisRadius:1;
			});		
		});
}

function drawColumn(select) {
	// TODO: output column names and, if set, unit
	var index = select.value;
	select.value = "none"; // reset select
	var radius = 5; // starting radius
	if (d3.select(".column[index='"+index+"']").size()>0) return; // return if column already drawn
	// create svg
	var svg = d3.select("body").append("svg").attr("width",columnWidth).attr("height",columnHeight)
		.attr("class","column")
		.attr("index", index)
		.attr("radius", radius);
	// draw data
	// TODO: implement arrays - drawing more than one circle per dataset
	var chartArea = svg.append("g").attr("class","chart").attr("transform","translate(50, 0)")
	var dataIndex = 0;
	// set a new timer
	// TODO: requestAnimationFrame
	var timer = setInterval(function() {
		if (data[dataIndex][index] !== undefined && data[dataIndex][index] !== null) { // don't draw if value is null or undefined
			drawCell(data[dataIndex], svg)
		}
		dataIndex++;
		if (dataIndex >= data.length) {window.clearInterval(timer);} // selfdestruct on end of data
	}, cellDrawSpeed);
}

function drawAxis(structure, svg) {
	// remove if already drawn
	svg.select(".axis").remove();
	switch(structure.type) {
		case "enum": break; // TODO
		case "int":
		case "float":
		default: var axis = d3.svg.axis()
			    .scale(structure.scale)
			    .orient("left")
			    .ticks(20);
			// TODO: draw boundaries if applicable
			svg.append("g").attr("transform", "translate(40,0)").attr("class","axis").call(axis); // TODO: what if labels are wider than 40px? big numbers? strings?
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
							var height = structure.topixel(structure.values[i].percent);
							// return middle of the placeable area and height
							return new Array(offset-height/2, height);
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
			// TODO: all cells drawn up to this point need to be repositioned
			break;
		case "int":
		case "float":
		default: if (data>structure.min && data<structure.max) return; // no change in scale
			if (data <= structure.min) { // set a new minimum at 5% of domain below actual minimum
				// if minimum value is close to zero, start the scale at zero
				structure.min = (data>0 && data<(structure.max-data) * 0.15)?0:data-(structure.max-data)*0.05; 
			}
			if (data >= structure.max) { // set a new maximum at 5% of domain above actual maximum
				structure.max = data+(data-structure.min)*0.05;
			}
			structure.scale.domain([structure.min, structure.max]);
			drawAxis(structure, svg); // redraw axis
			// all cells drawn up to this point need to be repositioned
			svg.selectAll(".cell").each(function() {
				var cell = d3.select(this);
				cell.attr("cy", Math.round(dataStructure[cell.attr("column")].scale(cell.attr("value"))));
				// TODO: collision detection
			});
	}	
}

// TODO: enum scale should group data below a certain height to "other"
// TODO: dynamic number of datasets
// TODO: optional adding group boundaries to floats and ints, or gradients, or colors
// TODO: dynamic output of grouped data for chart drawing (probably) (later)

init();
