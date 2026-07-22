package com.msu.itc583.netviz.controller;

import com.msu.itc583.netviz.dto.TopologyRequest;
import com.msu.itc583.netviz.dto.TopologySummary;
import com.msu.itc583.netviz.model.Topology;
import com.msu.itc583.netviz.service.TopologyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/topologies")
public class TopologyController {

    private final TopologyService service;

    public TopologyController(TopologyService service) {
        this.service = service;
    }

    @GetMapping
    public List<TopologySummary> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    public Topology get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Topology create(@Valid @RequestBody TopologyRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public Topology update(@PathVariable Long id, @Valid @RequestBody TopologyRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
