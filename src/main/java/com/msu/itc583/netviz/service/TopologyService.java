package com.msu.itc583.netviz.service;

import com.msu.itc583.netviz.dto.TopologyRequest;
import com.msu.itc583.netviz.dto.TopologySummary;
import com.msu.itc583.netviz.model.Topology;
import com.msu.itc583.netviz.repository.TopologyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class TopologyService {

    private final TopologyRepository repository;

    public TopologyService(TopologyRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TopologySummary> list() {
        return repository.findAllByOrderByUpdatedAtDesc().stream()
                .map(t -> new TopologySummary(
                        t.getId(),
                        t.getName(),
                        t.getDescription(),
                        t.getCreatedAt(),
                        t.getUpdatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public Topology get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topology not found: " + id));
    }

    @Transactional
    public Topology create(TopologyRequest request) {
        Topology t = new Topology();
        t.setName(request.getName().trim());
        t.setDescription(blankToNull(request.getDescription()));
        t.setTopologyJson(request.getTopologyJson());
        return repository.save(t);
    }

    @Transactional
    public Topology update(Long id, TopologyRequest request) {
        Topology t = get(id);
        t.setName(request.getName().trim());
        t.setDescription(blankToNull(request.getDescription()));
        t.setTopologyJson(request.getTopologyJson());
        return repository.save(t);
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Topology not found: " + id);
        }
        repository.deleteById(id);
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
