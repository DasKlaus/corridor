columnHeight = $(window).height()-100;
columnWidth = 150;
cellDrawSpeed = 1; // ms for each cell placement
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
		.attr("cy", function(d) {return Math.round(scale(data[index]));})
		.attr("cx", function(d) {
			// approximate distribution of cells over x axis
			// TODO: refine placement on requestAnimationFrame (collision detection)
			var y = Math.round(scale(data[index]));
			// get all cells that are already placed around the same y value
			var same = svg.selectAll(".cell").filter(function(d) {
					if (!d3.select(this).attr("value")) return false;
					return Math.abs(Math.round(scale(d3.select(this).attr("value"))-y))<radius*2+1;
				});
			if ((same[0].length+1)*(radius*2+1)>=columnWidth-50) { // if the next point would have no room left, reduce radius
				if (radius>0) {
					radius--;
					svg.attr("radius", radius);
					svg.selectAll(".cell").each(function() {
						// TODO: transitions!
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
	// generate axis
	var axis = d3.svg.axis()
	    .scale(structure.scale) // TODO: if enum, this will be different
	    .orient("left")
	    .ticks(20); // TODO: if enum, this will be different
	// TODO: draw boundaries if applicable
	svg.append("g").attr("transform", "translate(40,0)").attr("class","axis").call(axis); // TODO: what if labels are wider than 40px? big numbers? strings?
}

function checkScale(structure, data, svg) {
	if (!structure.scale) { // if no scale is set, create a new one and draw its axis
		switch(structure.type) {
			case "enum": break; // TODO
			case "int":
			case "float":
			default: structure.min = data;
				structure.max = data; 
				structure.scale = d3.scale.linear().domain([data-1, data+1]).range([columnHeight,0]);
				drawAxis(structure, svg);
		}
		return;
	}
	// check if scale is still correct
	switch(structure.type) {
		case "enum": break; // TODO
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

// TODO: dynamic number of datasets
// TODO: optional adding group boundaries to floats and ints, or gradients, or colors
// TODO: dynamic output of grouped data for chart drawing (probably) (later)

init();
