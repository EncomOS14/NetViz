package com.msu.itc583.netviz.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping({"/api/health", "/api/topologies/health"})
    public Map<String, String> health() {
        return Map.of("status", "ok", "app", "netviz");
    }
}
